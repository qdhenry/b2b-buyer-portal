# Statlab B2B Portal Customizations

This directory contains all Statlab-specific customizations for the B2B Portal application. By isolating customizations in this module, we can:

- **Easily track changes**: All custom code is in one place
- **Simplify upgrades**: Merging upstream changes is less likely to conflict
- **Improve maintainability**: Clear separation between base functionality and custom features
- **Document requirements**: Each customization is documented with its business purpose

## Current Customizations

### Order Detail Page

#### 1. Epicor Order ID Display

**Business Requirement**: Display the Epicor order ID instead of the BigCommerce order ID to users.

**Implementation**: 
- Extracts `epicoreOrderId` from the order's `extraFields` array
- Provides `getDisplayOrderId()` function that returns the Epicor ID with fallback to BC ID

**Usage**:
```tsx
// From OrderDetail page:
import { useOrderCustomizations } from '../customizations';
// Or from other locations:
import { useOrderCustomizations } from '@/pages/customizations';

const { epicoreOrderId, getDisplayOrderId } = useOrderCustomizations({ order });
const displayId = getDisplayOrderId(orderId);
```

## How to Add New Customizations

### Step 1: Update the Hook

Add your custom logic to `useOrderCustomizations.ts`:

```tsx
export const useOrderCustomizations = ({ order }) => {
  // Existing code...
  
  // Add your new customization
  const [customValue, setCustomValue] = useState('');
  
  useEffect(() => {
    // Your custom logic
  }, [order]);
  
  const customFunction = () => {
    // Your custom function
  };
  
  return {
    epicoreOrderId,
    getDisplayOrderId,
    customValue,      // Add new values
    customFunction,   // Add new functions
  };
};
```

### Step 2: Update Types

Add type definitions to `types.ts`:

```tsx
export interface UseOrderCustomizationsReturn {
  // Existing types...
  customValue: string;
  customFunction: () => void;
}
```

### Step 3: Document

Update this README with:
- What the customization does
- Why it's needed (business requirement)
- How to use it

### Step 4: Export (if creating new files)

If you create new utility files, export them from `index.ts`:

```tsx
export { useOrderCustomizations } from './useOrderCustomizations';
export { myNewUtility } from './myNewUtility';
```

## File Structure

```
src/pages/customizations/
├── README.md                      # This file - documentation
├── QUICKSTART.md                 # Quick reference guide
├── ARCHITECTURE.md               # System design and patterns
├── CHANGELOG.md                  # Version history
├── index.ts                       # Central export point
├── types.ts                       # TypeScript type definitions
├── useOrderCustomizations.ts      # Order-specific customization hook
└── [future files]                 # Additional hooks for other pages
```

## Best Practices

1. **Keep customizations isolated**: Don't modify core files unnecessarily
2. **Document everything**: Explain WHY each customization exists
3. **Use TypeScript**: Maintain type safety
4. **Write reusable code**: Think about how customizations might be used elsewhere
5. **Test thoroughly**: Ensure customizations don't break core functionality
6. **Version control**: Commit customizations separately from upstream merges

## Migration Guide

When updating the base B2B application:

1. Pull upstream changes
2. Check for conflicts in core files
3. If conflicts occur in any page component files, try to:
   - Accept upstream changes
   - Re-apply customization hook integration
4. Test all customizations still work
5. Update this README if needed

## Examples

### Using the Customization Hook

```tsx
// In OrderDetail/index.tsx
import { useOrderCustomizations } from '../customizations';

function OrderDetail() {
  const [order, setOrder] = useState(null);
  
  // Initialize customizations
  const { 
    epicoreOrderId, 
    getDisplayOrderId 
  } = useOrderCustomizations({ order });
  
  // Use in component
  const displayId = getDisplayOrderId(orderId);
  
  return (
    <Typography>
      Order ID: {displayId}
    </Typography>
  );
}
```

### Adding a New Customization

Example: Adding custom order status mapping

```tsx
// 1. Add to useOrderCustomizations.ts
const [epicorStatus, setEpicorStatus] = useState('');

useEffect(() => {
  if (order?.extraFields) {
    const statusField = order.extraFields.find(
      field => field.fieldName === 'epicorStatus'
    );
    setEpicorStatus(statusField?.fieldValue || '');
  }
}, [order]);

const getDisplayStatus = (bcStatus: string): string => {
  return epicorStatus || bcStatus;
};

return {
  // ... existing returns
  epicorStatus,
  getDisplayStatus,
};
```

## Support

For questions about these customizations, contact the Statlab development team.

## Changelog

### Version 1.0.0
- Initial setup of customizations module
- Added Epicor Order ID display customization
