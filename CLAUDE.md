# B2B Buyer Portal - Architecture & Implementation Guide

## Overview
This is an enterprise B2B e-commerce buyer portal built for BigCommerce's B2B Edition platform. It provides a comprehensive suite of B2B features including quotes, shopping lists, company hierarchies, and user management.

## Technology Stack

### Core Technologies
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite with legacy browser support
- **State Management:** Redux Toolkit + Redux Persist
- **API Layer:** GraphQL (gql.tada) + TanStack Query v5
- **UI Framework:** Material-UI (MUI) 5
- **Routing:** React Router 6 (hash-based)
- **Styling:** Emotion CSS-in-JS
- **Forms:** React Hook Form
- **i18n:** React Intl (7 languages)

### Development Tools
- **Monorepo:** Turborepo
- **Testing:** Vitest + Testing Library
- **Linting:** ESLint (airbnb-typescript)
- **Formatting:** Prettier
- **Mocking:** MSW (Mock Service Worker)

## Architecture Principles

### 1. Iframe Encapsulation
The entire app runs inside an iframe to prevent style conflicts with the host storefront. The `ThemeFrame` component handles this isolation.

### 2. Dual API Strategy
- **B2B API** (`https://api-b2b.bigcommerce.com`) - B2B-specific operations
- **BigCommerce API** - Storefront operations (cart, products, etc.)

### 3. Permission-Based Architecture
Two-layer permission system:
- **Role-based:** Traditional roles (Admin, Senior Buyer, Junior Buyer, etc.)
- **Code-based:** Granular feature permissions from B2B Edition

### 4. Lazy Loading
All pages use React.lazy() for optimal code splitting and performance.

### 5. Session Persistence
Redux state persisted to session storage to maintain state across page reloads.

## Project Structure

```
/apps/storefront/
├── src/
│   ├── pages/              # Feature pages (lazy-loaded)
│   │   ├── Dashboard/       # Admin/sales rep dashboard
│   │   ├── Orders/          # Order management
│   │   ├── Quotes/          # Quote creation and management
│   │   ├── ShoppingLists/   # B2B shopping lists
│   │   ├── QuickOrder/      # Bulk ordering
│   │   ├── Users/           # User management
│   │   └── ...
│   ├── components/          # Shared UI components
│   ├── store/              # Redux slices
│   │   ├── slices/
│   │   │   ├── company.ts   # Company/customer state
│   │   │   ├── global.ts    # App-wide state
│   │   │   ├── b2bFeatures.ts # B2B features (masquerade)
│   │   │   └── ...
│   ├── shared/
│   │   ├── service/        # API integration
│   │   │   ├── b2b/        # B2B GraphQL queries
│   │   │   ├── bc/         # BigCommerce APIs
│   │   │   └── request/    # Request utilities
│   │   ├── routes/         # Route definitions
│   │   └── global/         # Global contexts
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript definitions
```

## Key Features

### Sales Representative Masquerade
Sales reps can impersonate companies/customers to assist with orders. State managed in Redux `b2bFeatures.masqueradeCompany`.

### Company Hierarchy
Parent/subsidiary company management with feature access control. Subsidiaries can have limited access to specific features.

### Quote Management
- Create quotes from products or cart
- Draft quotes for incomplete submissions
- Messaging between buyer and seller
- Quote-to-order conversion

### Shopping Lists
B2B-specific lists for organizing bulk purchases. Support sharing across company users.

### Quick Order
Bulk ordering interface supporting:
- SKU search
- Quick add pad
- CSV import
- Product variants

## API Integration Patterns

### GraphQL Query Pattern
```typescript
// 1. Define query in shared/service/b2b/graphql/
const query = gql`
  query GetOrders($companyId: Int!) {
    orders(companyId: $companyId) {
      edges { ... }
    }
  }
`;

// 2. Use with TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['orders', companyId],
  queryFn: () => B3Request.graphqlB2B({ query, variables })
});
```

### Authentication Flow
1. Login via BigCommerce
2. Fetch B2B token
3. Get company info and permissions
4. Initialize Redux state
5. Route to permitted pages

## State Management

### Redux Slices
- `company` - Customer info, tokens, permissions
- `global` - App state (loading, messages)
- `b2bFeatures` - Masquerade, sales features
- `quoteInfo` - Quote draft management
- `storeInfo` - Store configuration
- `theme` - Theme frame state
- `lang` - Language selection

### Context Providers
- `GlobalContext` - App configuration
- `CustomStyleContext` - Dynamic theming
- `DynamicallyVariableContext` - Dialog management

## Permission System

### Role Mapping
```
0: Admin Buyer
1: Senior Buyer
2: Junior Buyer
3: Company Employee
4: Sales Representative
99: BC Customer (non-B2B)
100: Guest
```

### Permission Checking
```typescript
// Route-level
const checkPermission = b3CheckPermissions('read', 'quotes');

// Component-level
if (b3HaveAccessToPage(permissions, 'ORDERS')) {
  // Show feature
}
```

## Deployment

### Environment Variables
- `VITE_B2B_URL` - B2B API endpoint
- `VITE_LOCAL_APP_CLIENT_ID` - B2B Edition client ID
- `VITE_ASSETS_ABSOLUTE_PATH` - CDN URL for production
- `VITE_IS_LOCAL_ENVIRONMENT` - Development mode flag

### Deployment Targets

#### 1. Stencil Storefronts
Deploy to CDN and inject via script manager:
```javascript
window.b2b = {
  urls: {
    app: 'https://your-cdn.com'
  }
};
```

#### 2. Headless Storefronts
Include both module and legacy bundles:
```html
<script type="module" src="https://cdn/index.js"></script>
<script nomodule src="https://cdn/legacy/index.js"></script>
```

## Testing Strategy

### Test Structure
- Unit tests co-located in `tests/` directories
- Test utilities in `tests/test-utils.tsx`
- MSW for API mocking
- Builders for consistent test data

### Running Tests
```bash
yarn test          # Run tests
yarn test:coverage # With coverage
yarn test:ui       # Vitest UI
```

## Development Workflow

### Local Development
```bash
yarn install       # Install dependencies
yarn dev          # Start dev server (port 3001)
```

### Build Process
```bash
yarn build        # Production build
yarn build:analyze # With bundle analysis
```

### Code Quality
```bash
yarn lint         # ESLint
yarn format       # Prettier
yarn typecheck    # TypeScript
```

## Common Patterns

### Loading States
Use `GlobaledContext` for app-wide loading mask:
```typescript
dispatch(setPageLoading(true));
// ... async operation
dispatch(setPageLoading(false));
```

### Error Handling
Consistent error display via snackbar:
```typescript
snackbar.error(b3Lang('global.errorTip'));
```

### Dynamic Routing
Routes generated based on permissions:
```typescript
const routes = getRoutes({
  isB2BUser,
  role,
  permissions,
  isLoggedIn
});
```

## Important Gotchas

1. **Hash Routing:** App uses hash routing (`#/`) for iframe compatibility
2. **Token Storage:** All auth tokens in session storage, not local storage
3. **Permission Cascade:** Check both role and code permissions
4. **API Rate Limits:** Use TanStack Query caching to minimize API calls
5. **Theme Conflicts:** Always use Emotion styled components inside ThemeFrame

## Performance Considerations

1. **Code Splitting:** All pages lazy-loaded
2. **Query Caching:** 5-minute stale time for most queries
3. **Bundle Size:** Vendor chunks for React, MUI, utilities
4. **Legacy Support:** Polyfills for older browsers via Vite legacy plugin

## Security Notes

1. **Token Management:** B2B tokens expire, handle refresh
2. **XSS Prevention:** All user input sanitized
3. **CORS:** Proxy configuration for local development
4. **Permission Checks:** Always verify on both client and server

## Debugging Tips

1. **Redux DevTools:** Available in development
2. **React Query DevTools:** Shows cache state
3. **Network Tab:** Monitor GraphQL queries
4. **Console Logs:** Disabled in production via Vite define

## Key Files to Know

- `src/App.tsx` - Root component with all providers
- `src/shared/routes/routes.tsx` - Route configuration
- `src/shared/service/request/base.ts` - API configuration
- `src/utils/b3CheckPermissions/index.ts` - Permission utilities
- `src/store/index.ts` - Redux store setup
- `vite.config.ts` - Build configuration

## Contact Points

For B2B-specific questions, consult:
- B2B Edition API documentation
- BigCommerce GraphQL playground
- Internal B2B team documentation