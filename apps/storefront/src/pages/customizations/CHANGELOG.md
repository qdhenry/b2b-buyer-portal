# Changelog - B2B Portal Customizations

All notable customizations to the B2B Portal application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-11-20

### Changed

#### Customization Module Relocation

- **Moved customizations directory** from `/OrderDetail/customizations` to `/pages/customizations`
  - Purpose: Centralize all page-level customizations in one location
  - Impact: Allows sharing customizations across multiple pages
  - Import paths updated: Use `../customizations` from page components

#### Documentation Updates

- **Updated all documentation** to reflect the new centralized structure
  - README.md: Now describes general B2B Portal customizations
  - QUICKSTART.md: Updated import paths and examples
  - ARCHITECTURE.md: Expanded to show multi-page architecture
  - CHANGELOG.md: Now tracks all customizations, not just OrderDetail

### Added

#### Infrastructure for Future Customizations

- **Prepared module structure** for additional customization hooks
  - Future hooks can be added for Quotes, Users, Products, etc.
  - Each hook will follow the same pattern as `useOrderCustomizations`
  - All customizations centralized in `/pages/customizations`

## [1.0.0] - 2024-01-10

### Added

#### Customization Infrastructure

- **Created customizations module structure** (initially in `/OrderDetail/customizations`)
  - Purpose: Isolate all Statlab-specific customizations for easier maintenance and upgrades
  - Impact: Separates custom code from base application code
  - Files: `index.ts`, `types.ts`, `README.md`, `QUICKSTART.md`

#### useOrderCustomizations Hook

- **Created main customization hook** (`useOrderCustomizations.ts`)
  - Purpose: Central place for all order-related customizations
  - Exports: Hook for managing custom order data transformations
  - Dependencies: React hooks (useState, useEffect)

#### Epicor Order ID Display

- **Business Requirement**: Display Epicor order ID instead of BigCommerce order ID
  - Field Source: `extraFields` array in order response
  - Field Name: `epicorOrderId`
  - Implementation: Extracted via `useOrderCustomizations` hook
  - Fallback: Shows BigCommerce order ID if Epicor ID not available
- **Modified Files**:
  - `index.tsx`: Added `orderData` state, integrated customization hook
  - Line 95: Added `OrderData` type for order state
  - Line 98: Initialized `useOrderCustomizations` hook
  - Line 123: Store raw order data for customization hook
  - Line 278: Display Epicor order ID using `getDisplayOrderId()`

- **Technical Details**:
  - Hook accepts raw order object with `extraFields` array
  - Returns `getDisplayOrderId()` function that prioritizes Epicor ID
  - Returns `epicorOrderId` string for direct access
  - Updates automatically when order data changes

### Changed

- **Modified order data flow in `index.tsx`**
  - Added `setOrderData(order)` call after fetching order details
  - Ensures customization hook receives complete order information
  - No breaking changes to existing functionality

### Comments Added

- Added `// STATLAB CUSTOMIZATION:` comments in main file to mark custom code
- Comments added at:
  - Line 97: Hook initialization
  - Line 123: Order data storage
  - Line 278: Epicor ID display

---

## Guidelines for Future Entries

When adding customizations, document them here using this format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- **Feature Name**
  - Business Requirement: Why this was needed
  - Implementation: How it was done
  - Files Changed: What files were modified
  - Technical Details: Important notes

### Changed

- What was modified and why

### Deprecated

- Features that are being phased out

### Removed

- Features that were removed

### Fixed

- Bug fixes

### Security

- Security-related changes
```

---

## Version Number Guidelines

- **MAJOR** (X.0.0): Breaking changes to customization API
- **MINOR** (0.X.0): New customizations added in backwards-compatible manner
- **PATCH** (0.0.X): Bug fixes and minor improvements

---

## Customization Categories

Use these categories when documenting changes:

- **Display Customizations**: Changes to what users see
- **Data Processing**: How data is transformed or calculated
- **Integration**: External system integrations (e.g., Epicor)
- **Validation**: Custom validation logic
- **Business Rules**: Custom business logic
- **Performance**: Optimization changes
- **Infrastructure**: Changes to customization system itself

---

## Template for New Customizations

````markdown
### [Category] - Customization Name

**Business Requirement**:
[Explain why this was needed from a business perspective]

**Technical Implementation**:

- Hook/Function: [Name of function or hook]
- Data Source: [Where the data comes from]
- Files Modified: [List of files changed]
- Dependencies: [Any new dependencies added]

**Usage Example**:

```tsx
// Example code showing how to use this customization
```
````

**Testing Notes**:

- [How to test this customization]
- [Edge cases to consider]

**Migration Notes** (if applicable):

- [Any notes for upgrading from previous versions]

```

---

## Maintenance Notes

### When Merging Upstream Changes

1. Review this changelog before merging
2. Check if upstream changes affect any customizations
3. Update version number if customizations need modification
4. Document any merge conflicts and resolutions
5. Test all customizations after merge

### Regular Review Schedule

- **Monthly**: Review all customizations for optimization opportunities
- **Quarterly**: Evaluate if customizations can be contributed back to upstream
- **Yearly**: Major review of all customizations, remove obsolete ones

---

## Contact

For questions about customizations or to propose new ones:
- Statlab Development Team
- Document all requests with business justification

---

**Legend**:
- 🆕 New customization
- ⚠️ Breaking change
- 🐛 Bug fix
- 📝 Documentation update
- 🔧 Configuration change
- ⚡ Performance improvement
```
