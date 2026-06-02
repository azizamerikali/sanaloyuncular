---
name: Corporate Minimalist Admin
colors:
  surface: '#f7f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f7f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f7'
  surface-container: '#eceef1'
  surface-container-high: '#e6e8eb'
  surface-container-highest: '#e0e3e6'
  on-surface: '#191c1e'
  on-surface-variant: '#454652'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f4'
  outline: '#767683'
  outline-variant: '#c6c5d4'
  surface-tint: '#4c56af'
  primary: '#000666'
  on-primary: '#ffffff'
  primary-container: '#1a237e'
  on-primary-container: '#8690ee'
  inverse-primary: '#bdc2ff'
  secondary: '#2b5bb5'
  on-secondary: '#ffffff'
  secondary-container: '#759efd'
  on-secondary-container: '#00337c'
  tertiary: '#001c35'
  on-tertiary: '#ffffff'
  tertiary-container: '#003157'
  on-tertiary-container: '#2c9bf9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bdc2ff'
  on-primary-fixed: '#000767'
  on-primary-fixed-variant: '#343d96'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#b0c6ff'
  on-secondary-fixed: '#001945'
  on-secondary-fixed-variant: '#00429c'
  tertiary-fixed: '#d1e4ff'
  tertiary-fixed-dim: '#9ecaff'
  on-tertiary-fixed: '#001d36'
  on-tertiary-fixed-variant: '#00497d'
  background: '#f7f9fc'
  on-background: '#191c1e'
  surface-variant: '#e0e3e6'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 260px
---

## Brand & Style
This design system is engineered for high-density information management and administrative efficiency. It targets enterprise users and administrators who require a focused, distraction-free environment for member management. 

The aesthetic is **Corporate Minimalism**: it prioritizes functional clarity and systematic organization. By leveraging generous whitespace, a constrained color palette, and subtle elevation, the UI evokes a sense of reliability, precision, and authority. The design language moves away from the flat, uninspiring look of traditional legacy dashboards toward a modern, breathable interface that reduces cognitive load during long work sessions.

## Colors
The palette is anchored by **Deep Corporate Blue**, used for critical actions and primary navigation to establish authority. **Professional Blue** serves as a secondary accent for interactive states and focus indicators.

The background uses a cool-toned **Light Gray** (`#f5f7fa`) to differentiate the canvas from the **White** (`#ffffff`) surface cards. This contrast is essential for defining "work areas" without the need for heavy borders. Success, warning, and error states should follow standard semantic conventions but with slightly desaturated tones to maintain the professional atmosphere.

## Typography
**Inter** is selected for its exceptional legibility in data-heavy environments and its neutral, systematic character. 

The hierarchy is strictly defined to guide the user's eye from primary page titles down to granular data points.
- **Headlines:** Use Semi-Bold and Bold weights to anchor the page.
- **Body Text:** Standardized at 14px for optimal balance between density and readability in tables and forms.
- **Labels:** Small, uppercase labels with slight letter spacing are used for table headers and metadata categories to provide structure without competing with the actual data content.

## Layout & Spacing
The design system utilizes a **12-column fluid grid** for the main content area, paired with a **fixed left-hand sidebar**. 

- **Sidebar:** Remains fixed at 260px on desktop to provide a consistent navigation anchor.
- **Margins & Gutters:** A 24px gutter maintains clear separation between dashboard widgets and data cards.
- **Content Density:** In member management views, vertical rhythm is tight (8px/16px) to maximize information visibility, while page-level padding is generous (32px) to prevent the UI from feeling claustrophobic.
- **Breakpoints:** On tablet and mobile, the sidebar collapses into a hamburger menu, and the 32px desktop margins reduce to 16px to conserve horizontal real estate.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** supplemented by **Ambient Shadows**. 

1. **Level 0 (Background):** Light Gray (`#f5f7fa`) surface.
2. **Level 1 (Cards/Sidebar):** White (`#ffffff`) surface with a very soft, diffused shadow (`0px 4px 12px rgba(0, 0, 0, 0.05)`). This makes the content appear to float slightly above the canvas.
3. **Level 2 (Dropdowns/Modals):** Increased elevation with a more pronounced shadow (`0px 8px 24px rgba(0, 0, 0, 0.12)`) and a subtle 1px border in a light neutral tone to ensure sharp edges against the white background.

Avoid using heavy inner shadows or high-opacity drop shadows to maintain the minimalist professional aesthetic.

## Shapes
A **Rounded (0.5rem / 8px)** base is the standard for the design system. This strikes the balance between the clinical feel of sharp corners and the overly casual feel of pill shapes.

- **Buttons & Inputs:** Use the 8px base radius.
- **Cards & Containers:** Use `rounded-lg` (16px) to clearly frame content blocks.
- **Avatars:** Always circular to provide a soft organic contrast against the structured grid.

## Components
### Buttons
- **Primary:** Solid Deep Corporate Blue with white text. High-contrast and identifiable.
- **Secondary:** Outlined Professional Blue with 1px border.
- **Ghost:** No background or border; used for secondary navigation or utility actions.

### Member Management Tables
- **Rows:** 56px minimum height. Hover state uses a very light blue tint (`#f0f4ff`) instead of a border.
- **Header:** Uppercase `label-md` typography with a subtle bottom divider.
- **Status Badges:** Small, rounded-sm chips with low-opacity background colors matching the semantic status (e.g., Active = Light Green background, Dark Green text).

### Input Fields
- Standardized with a 1px neutral border that transitions to Professional Blue on focus.
- Labels are always positioned above the field using `label-sm` for maximum clarity.

### Cards
- White background, 16px padding, and 8px/16px rounded corners.
- Every card should have a clear `headline-sm` title area.

### Navigation
- **Sidebar Items:** Clear icon-and-label structure. The "Active" state uses a subtle left-aligned vertical bar in Primary Blue and a light blue background bleed to highlight the current location.