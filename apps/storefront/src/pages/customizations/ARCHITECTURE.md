# Architecture - B2B Portal Customizations

This document describes the architecture and design patterns used in the Statlab B2B Portal customizations module.

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Page Components Layer                        │
│            (OrderDetail, Orders, Quotes, etc.)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Core State Management                    │  │
│  │  - Component IDs (for API calls)                          │  │
│  │  - Raw data objects ◄──────────────────┐                  │  │
│  │  - Processed data                      │                  │  │
│  └──────────────────────────────────────────┼────────────────┘  │
│                                              │                    │
│  ┌──────────────────────────────────────────┼────────────────┐  │
│  │      STATLAB CUSTOMIZATIONS MODULE       │                │  │
│  │         /pages/customizations            │                │  │
│  │                                           │                │  │
│  │  Hooks:                                  │                │  │
│  │    - useOrderCustomizations({ order })   │                │  │
│  │    - [future: useQuoteCustomizations]    │                │  │
│  │    - [future: useUserCustomizations]     │                │  │
│  │                                           │                │  │
│  │  Input: Raw data ─────────────────────────┘                │  │
│  │  Output: Customized values & functions                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      UI Rendering                          │  │
│  │  - Display customized data                                 │  │
│  │  - Show custom fields                                      │  │
│  │  - Apply custom formatting                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
1. User Navigates to Order Detail
         │
         ▼
2. Fetch Order Data (API Call)
   getB2BOrderDetails(id) or getBCOrderDetails(id)
         │
         ▼
3. Store Raw Order Data
   setOrderData(order) ◄───────────┐
         │                          │
         ├──────────────────────────┤
         │                          │
         ▼                          │
4a. Process for Core App           │ 4b. Process for Customizations
    convertB2BOrderDetails()       │      useOrderCustomizations()
         │                          │           │
         ▼                          │           ▼
5a. Store in Context               │      Extract extraFields
    dispatch({ type: 'all' })      │           │
         │                          │           ▼
         │                          │      Parse epicoreOrderId
         │                          │           │
         │                          │           ▼
         │                          │      Store in local state
         │                          │           │
         │                          └───────────┘
         │
         ▼
6. Render UI Components
   - Use epicoreOrderId for display
   - Use orderId for API calls
```

## 📁 Module Structure

```
src/pages/customizations/
│
├── index.ts                    # Public API / Exports
│   └── Exports: { useOrderCustomizations, types }
│
├── types.ts                    # TypeScript Definitions
│   ├── ExtraField
│   ├── OrderData
│   ├── UseOrderCustomizationsProps
│   └── UseOrderCustomizationsReturn
│
├── useOrderCustomizations.ts   # Order Hook Implementation
│   ├── State Management
│   ├── Data Extraction Logic
│   ├── Transformation Functions
│   └── Return API
│
├── [future hooks]              # Additional customization hooks
│   ├── useQuoteCustomizations.ts
│   ├── useUserCustomizations.ts
│   └── useProductCustomizations.ts
│
├── README.md                   # Comprehensive Documentation
├── QUICKSTART.md              # Quick Reference Guide
├── CHANGELOG.md               # Version History
└── ARCHITECTURE.md            # This File
```

## 🎯 Design Principles

### 1. Separation of Concerns
```
Core Application              Customizations Module
─────────────────            ────────────────────
│ Data Fetching   │          │ Data Extraction   │
│ State Management│          │ Transformation    │
│ UI Rendering    │ ◄─────── │ Custom Logic      │
│ Business Logic  │          │ Helper Functions  │
─────────────────            ────────────────────
```

**Why**: Keeps custom code isolated for easier maintenance and upgrades.

### 2. Single Source of Truth
```
API Response (Raw Order Data)
         │
         ├──► setOrderData(order)
         │            │
         │            ├──► Core Processing
         │            │     (convertB2BOrderDetails)
         │            │
         │            └──► Custom Processing
         │                  (useOrderCustomizations)
         │
         └──► Both use same source data
```

**Why**: Ensures consistency and prevents data synchronization issues.

### 3. Progressive Enhancement
```
Display Logic:
┌──────────────────────────────────────────┐
│ getDisplayOrderId(fallbackId)            │
│                                           │
│ IF epicoreOrderId exists:                │
│    RETURN epicoreOrderId                 │
│ ELSE:                                     │
│    RETURN fallbackId (BigCommerce ID)    │
└──────────────────────────────────────────┘
```

**Why**: Application works even if custom data is missing.

### 4. Explicit Over Implicit
```tsx
// Bad - Implicit
const orderId = epicoreOrderId || bcOrderId;

// Good - Explicit Function
const getDisplayOrderId = (fallback: string) => 
  epicoreOrderId || fallback;
```

**Why**: Makes intent clear and easier to maintain.

## 🔌 Integration Points

### Page Component Integration
```typescript
// Example: OrderDetail/index.tsx

// 1. Import
import { useOrderCustomizations, type OrderData } from '../customizations';

// 2. State for raw order data
const [orderData, setOrderData] = useState<OrderData | null>(null);

// 3. Initialize hook
const { getDisplayOrderId } = useOrderCustomizations({ order: orderData });

// 4. Store raw data after fetch
const order = await getB2BOrderDetails(id);
setOrderData(order); // ← Feeds customization hook

// 5. Use in UI
<Typography>
  {b3Lang('orderDetail.orderId', { 
    orderId: getDisplayOrderId(orderId) 
  })}
</Typography>
```

### Hook Internal Structure
```typescript
// useOrderCustomizations.ts

export const useOrderCustomizations = ({ order }) => {
  // 1. Local State
  const [epicoreOrderId, setEpicoreOrderId] = useState<string>('');
  
  // 2. Data Extraction
  useEffect(() => {
    if (order?.extraFields) {
      const field = order.extraFields.find(
        f => f.fieldName === 'epicoreOrderId'
      );
      setEpicoreOrderId(field?.fieldValue || '');
    }
  }, [order]);
  
  // 3. Helper Functions
  const getDisplayOrderId = (fallback: string) => 
    epicoreOrderId || fallback;
  
  // 4. Public API
  return {
    epicoreOrderId,
    getDisplayOrderId,
  };
};
```

## 🧩 Extensibility Patterns

### Adding New Customizations

```typescript
// Pattern 1: Extract Single Field
const [customField, setCustomField] = useState<string>('');

useEffect(() => {
  const field = order?.extraFields?.find(
    f => f.fieldName === 'yourFieldName'
  );
  setCustomField(field?.fieldValue || '');
}, [order]);

// Pattern 2: Extract Multiple Fields
const [customData, setCustomData] = useState({
  field1: '',
  field2: '',
});

useEffect(() => {
  if (order?.extraFields) {
    setCustomData({
      field1: extractField('field1'),
      field2: extractField('field2'),
    });
  }
}, [order]);

// Pattern 3: Add Transformation Function
const formatCustomData = (data: string): string => {
  // Custom logic
  return transformedData;
};

// Pattern 4: Add Validation
const validateCustomField = (value: string): boolean => {
  // Validation logic
  return isValid;
};
```

## 🔒 Type Safety

```typescript
// Type Flow
OrderData (from API)
    │
    ├─► UseOrderCustomizationsProps
    │        │
    │        ▼
    │   useOrderCustomizations()
    │        │
    │        ▼
    └─► UseOrderCustomizationsReturn
              │
              ▼
         Component Usage
```

**Benefits**:
- Compile-time error checking
- IntelliSense support
- Self-documenting code
- Refactoring safety

## 📊 State Management Strategy

```
┌─────────────────────────────────────────┐
│         Component State                  │
├─────────────────────────────────────────┤
│                                          │
│  orderId (string)                        │
│  ├─ Used for: API calls, routing        │
│  └─ Source: URL params                   │
│                                          │
│  orderData (OrderData | null)            │
│  ├─ Used for: Customizations hook       │
│  └─ Source: API response (raw)          │
│                                          │
├─────────────────────────────────────────┤
│         Context State                    │
├─────────────────────────────────────────┤
│                                          │
│  detailsData (Processed)                 │
│  ├─ Used for: Core app display          │
│  └─ Source: convertB2BOrderDetails()    │
│                                          │
├─────────────────────────────────────────┤
│    Customization Hook State              │
├─────────────────────────────────────────┤
│                                          │
│  epicoreOrderId (string)                 │
│  ├─ Used for: Display to user           │
│  └─ Source: extraFields extraction      │
│                                          │
└─────────────────────────────────────────┘
```

## 🎨 Commenting Convention

All customizations in main files use this pattern:

```typescript
// STATLAB CUSTOMIZATION: [Brief description]
[customized code]
```

**Examples**:
```typescript
// STATLAB CUSTOMIZATION: Initialize custom order data handling
const { getDisplayOrderId } = useOrderCustomizations({ order: orderData });

// STATLAB CUSTOMIZATION: Store raw order data for customization hook
setOrderData(order);

// STATLAB CUSTOMIZATION: Display Epicor Order ID instead of BC Order ID
{b3Lang('orderDetail.orderId', { orderId: getDisplayOrderId(orderId) })}
```

**Why**: Makes it easy to identify and track customizations during upgrades.

## 🔄 Update & Maintenance Flow

```
1. Upstream Update Available
         │
         ▼
2. Review CHANGELOG.md
   (Check what customizations exist)
         │
         ▼
3. Merge Upstream Changes
   (Core files may have conflicts)
         │
         ▼
4. Search for "STATLAB CUSTOMIZATION"
   (Find integration points)
         │
         ▼
5. Re-apply Customizations
   (Use customizations module)
         │
         ▼
6. Test All Customizations
   (Verify nothing broke)
         │
         ▼
7. Update CHANGELOG.md
   (Document any changes)
```

## 🧪 Testing Strategy

```
┌──────────────────────────────────────┐
│         Unit Tests                    │
│  - Test hook in isolation            │
│  - Test helper functions             │
│  - Test data extraction              │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│      Integration Tests                │
│  - Test hook with real order data    │
│  - Test fallback behavior            │
│  - Test edge cases                   │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│        E2E Tests                      │
│  - Test full order detail flow       │
│  - Test with/without Epicor data     │
│  - Test UI displays correctly        │
└──────────────────────────────────────┘
```

## 🚀 Performance Considerations

### Memoization Strategy
```typescript
// Only re-run when order data actually changes
useEffect(() => {
  // Extract data
}, [order]); // Dependency array

// Memoize expensive computations
const expensiveResult = useMemo(() => {
  return expensiveComputation(order);
}, [order]);
```

### Avoiding Re-renders
```typescript
// Return stable function references
const getDisplayOrderId = useCallback(
  (fallback: string) => epicoreOrderId || fallback,
  [epicoreOrderId]
);
```

## 📝 Documentation Hierarchy

```
QUICKSTART.md ──► For quick reference and common tasks
     │
     ├──► For in-depth understanding
     ▼
README.md ──────► Comprehensive guide
     │
     ├──► For system architecture
     ▼
ARCHITECTURE.md ► This file (design & patterns)
     │
     ├──► For tracking changes
     ▼
CHANGELOG.md ───► Version history & modifications
```

## 🎯 Future Enhancements

Potential areas for expansion:

1. **Multiple Custom Fields**
   - Status mappings
   - Custom pricing
   - Shipping information

2. **Validation Layer**
   - Custom business rules
   - Data validation

3. **Formatting Utilities**
   - Date formatters
   - Currency formatters
   - Address formatters

4. **Integration Helpers**
   - API call wrappers
   - Data transformers
   - Error handlers

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-10  
**Maintained By**: Statlab Development Team
