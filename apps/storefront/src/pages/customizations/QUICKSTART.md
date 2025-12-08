# Quick Start Guide - B2B Portal Customizations

This guide will help you quickly get started with the Statlab customizations module for the B2B Portal.

## 🚀 Using Existing Customizations

### Display Epicor Order ID

The `useOrderCustomizations` hook automatically extracts and provides the Epicor order ID from the order's `extraFields`.

```tsx
// From OrderDetail page:
import { useOrderCustomizations, type OrderData } from '../customizations';
// Or from other pages:
import { useOrderCustomizations, type OrderData } from '@/pages/customizations';

function YourComponent() {
  const [orderData, setOrderData] = useState<OrderData | null>(null);

  // Initialize the hook
  const { getDisplayOrderId, epicorOrderId } = useOrderCustomizations({
    order: orderData,
  });

  // Use the display order ID (returns epicorOrderId if available, otherwise fallback)
  const displayId = getDisplayOrderId(orderId);

  // Or access directly
  console.log('Epicor Order ID:', epicorOrderId);

  return <div>Order: {displayId}</div>;
}
```

**Important**: Make sure to pass the raw order data to the hook:

```tsx
// When fetching order data
const order = await getB2BOrderDetails(id);
setOrderData(order); // Store raw order for customizations hook
```

## ➕ Adding a New Customization

### Example: Add Custom Order Note Field

**Step 1**: Update `useOrderCustomizations.ts`

```tsx
// Add state
const [customNote, setCustomNote] = useState<string>('');

// Add effect to extract data
useEffect(() => {
  if (order?.extraFields) {
    const noteField = order.extraFields.find(
      (field: ExtraField) => field.fieldName === 'customOrderNote',
    );
    setCustomNote(noteField?.fieldValue || '');
  }
}, [order]);

// Add to return object
return {
  epicorOrderId,
  getDisplayOrderId,
  customNote, // Add new value
};
```

**Step 2**: Update `types.ts`

```tsx
export interface UseOrderCustomizationsReturn {
  epicorOrderId: string;
  getDisplayOrderId: (fallbackOrderId: string) => string;
  customNote: string; // Add new type
}
```

**Step 3**: Use in your component

```tsx
const { customNote } = useOrderCustomizations({ order: orderData });

return <Typography>{customNote}</Typography>;
```

## 📋 Common Patterns

### Extracting from extraFields

```tsx
const fieldValue =
  order?.extraFields?.find((field) => field.fieldName === 'yourFieldName')?.fieldValue || 'default';
```

### Adding Transformation Functions

```tsx
const formatCustomDate = (date: string): string => {
  // Your formatting logic
  return formattedDate;
};

return {
  // ... other returns
  formatCustomDate,
};
```

### Working with Multiple Fields

```tsx
const [customData, setCustomData] = useState({
  field1: '',
  field2: '',
  field3: '',
});

useEffect(() => {
  if (order?.extraFields) {
    setCustomData({
      field1: order.extraFields.find((f) => f.fieldName === 'field1')?.fieldValue || '',
      field2: order.extraFields.find((f) => f.fieldName === 'field2')?.fieldValue || '',
      field3: order.extraFields.find((f) => f.fieldName === 'field3')?.fieldValue || '',
    });
  }
}, [order]);
```

## 🔍 Debugging

### Check if data is being passed correctly

```tsx
useEffect(() => {
  console.log('Order data in customizations:', order);
  console.log('Extra fields:', order?.extraFields);
}, [order]);
```

### Verify hook is receiving updates

```tsx
const customizations = useOrderCustomizations({ order: orderData });
console.log('Customizations:', customizations);
```

## ⚠️ Common Mistakes

### ❌ Don't do this:

```tsx
// Passing undefined or not storing order data
const { getDisplayOrderId } = useOrderCustomizations({ order: undefined });
```

### ✅ Do this instead:

```tsx
const [orderData, setOrderData] = useState<OrderData | null>(null);

// In your fetch function
const order = await getB2BOrderDetails(id);
setOrderData(order); // Store it!

const { getDisplayOrderId } = useOrderCustomizations({ order: orderData });
```

### ❌ Don't modify core order data structures

```tsx
// Bad - modifying core data
order.id = epicorOrderId; // Don't!
```

### ✅ Use transformation functions instead

```tsx
// Good - provide transformed values
const getDisplayOrderId = (fallbackId: string) => epicorOrderId || fallbackId;
```

## 🔗 Related Files

- `useOrderCustomizations.ts` - Main hook implementation
- `types.ts` - TypeScript type definitions
- `index.ts` - Export configuration
- `README.md` - Detailed documentation

## 💡 Tips

1. **Keep it isolated**: All customizations should stay within the `/pages/customizations` folder
2. **Document everything**: Add comments explaining WHY each customization exists
3. **Test fallbacks**: Always provide fallback values for missing data
4. **Use TypeScript**: Maintain type safety for easier maintenance
5. **Comment your changes**: Use `// STATLAB CUSTOMIZATION:` prefix in page component files

## 🆘 Need Help?

1. Check the main [README.md](./README.md) for detailed documentation
2. Review existing customizations in `useOrderCustomizations.ts`
3. Look at how it's integrated in page components (e.g., `OrderDetail/index.tsx`)
4. Contact the Statlab development team

---

**Last Updated**: Version 1.0.0
