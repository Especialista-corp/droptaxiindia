# CLAUDE.md - Drop Taxi India

## Project Overview

Drop Taxi India is a taxi booking website for intercity drop taxi services across South India. The site allows customers to calculate trip distances, view pricing for different car types, and book rides with instant confirmation via SMS and Telegram notifications.

**Live site:** https://droptaxiindia.com

## Technology Stack

- **Frontend:** Static HTML5, vanilla JavaScript, jQuery 3.3.1
- **CSS Framework:** Bootstrap 3/4 with custom theme (`css/style.css`)
- **Backend:** PHP (minimal — form email submissions only)
- **Hosting:** GitHub Pages (static files) + PHP-capable server for form handlers
- **No build tools, no package manager, no bundler** — files are served as-is

## Directory Structure

```
/
├── CNAME                    # GitHub Pages custom domain (droptaxiindia.com)
├── index.html               # Main landing page with booking form
├── index1.html              # Alternative landing page variant
├── book-now.html            # Primary booking page with map + pricing
├── book-now2.html           # Simplified booking page
├── trip-estimate.html       # Trip distance/cost estimator with map
├── round-trip.html          # Round-trip booking page
├── bookingSuccess.html      # Post-booking confirmation (reads localStorage)
├── about-us.html            # About page
├── contact-us.html          # Contact page with enquiry form
├── services.html            # Services overview
├── tariff.html              # Pricing/tariff information
├── tour-packages.html       # Tour package listings
├── card.html                # Card-style layout page
├── bangalore.html           # City-specific landing page
├── chennai.html             # City-specific landing page
├── coimbatore.html          # City-specific landing page
├── madurai.html             # City-specific landing page
├── salem.html               # City-specific landing page
├── trichy.html              # City-specific landing page
├── enquiry.php              # Contact form email handler
├── home-enquiry.php         # Home page enquiry form email handler
├── css/
│   ├── bootstrap.css        # Bootstrap framework
│   ├── fonts.css            # Web font declarations
│   └── style.css            # Main stylesheet (~19,000 lines, all custom styles)
├── js/
│   ├── core.min.js          # Minified vendor bundle (Bootstrap, jQuery plugins)
│   ├── script.js            # Site-wide UI initialization and form validation
│   ├── map.js               # Google Maps integration and price calculation
│   ├── map1.js              # Alternate map configuration
│   └── fast2.js             # Booking submission (Telegram + SMS + localStorage)
├── fonts/                   # Icon font files (Linearicons, FontAwesome, MDI)
└── images/
    ├── cars/                # Vehicle type images
    └── tour-packages/       # Tour package images
```

## Key JavaScript Modules

### `js/map.js` — Distance & Price Calculator
- Initializes Google Maps with DirectionsService and DirectionsRenderer
- `calcRoute()` — calculates driving distance between two cities, computes pricing
- Uses Google Places Autocomplete restricted to Indian cities
- Pricing formula: `(distance_km * rate_per_km) + driver_bata`
- Minimum distance enforced: **130 km**
- Price variables: `sedano`, `sedanr`, `suvo`, `suvr`, `psuvo`, `psuvr`, `traveller`

### `js/fast2.js` — Booking Handler
- `book()` — collects form data, determines rate based on car type + service type
- Sends booking details to Telegram Bot API
- Sends SMS confirmation via Fast2SMS API
- Stores booking data in `localStorage` for the confirmation page
- Redirects to `bookingSuccess.html` on success

### `js/script.js` — UI Framework
- Initializes Bootstrap components, navigation (RD Navbar), carousels (Owl)
- Form validation via Regula.js
- Scroll animations via WOW.js
- Preloader and page transition effects

### `js/core.min.js` — Vendor Bundle
- Minified concatenation of jQuery plugins, Bootstrap JS, and UI libraries
- **Do not edit** — this is a pre-built vendor file

## Pricing Model

### Car Types
| Car Type | One-Way Rate/km | Round-Trip Rate/km | Driver Bata |
|----------|-----------------|---------------------|-------------|
| Sedan | Rs.13 | Rs.10 | Rs.400 |
| Prime Sedan | Rs.14 | Rs.11 | Rs.400 |
| SUV | Rs.18 | Rs.13 | Rs.400 |
| Prime SUV | Rs.19 | Rs.14 | Rs.400 |
| Traveller | N/A | Rs.18 | Rs.500 |

### Price Calculation
- **One-Way:** `(distance * rate) + 400`
- **Round-Trip:** `2 * ((distance * rate) + bata)`
- **Minimum distance:** 130 km (shorter trips are charged at 130 km)
- Traveller is round-trip only

## Booking Flow

```
1. User enters pickup/drop locations
2. Google Maps calculates driving distance
3. Prices displayed per car type (one-way or round-trip)
4. User selects car type and fills in details (name, phone, date, time)
5. On submit: booking sent to admin via Telegram Bot, SMS sent to customer
6. Booking data stored in localStorage
7. User redirected to bookingSuccess.html (reads localStorage to display details)
```

## PHP Backend

Two PHP files handle email-based enquiry forms:
- **`enquiry.php`** — processes contact form (name, email, phone, pickup, drop)
- **`home-enquiry.php`** — processes home page enquiry (email, phone, pickup, drop)
- Both use PHP `mail()` to send to `droptaxiindia21@gmail.com`
- No database, no ORM — email-only processing

## External API Integrations

| Service | Purpose | Integration Point |
|---------|---------|-------------------|
| Google Maps Directions API | Route distance calculation | `js/map.js` |
| Google Places Autocomplete | City search input | `js/map.js` |
| Telegram Bot API | Admin booking notifications | `js/fast2.js` |
| Fast2SMS | Customer SMS confirmations | `js/fast2.js` |
| Google Analytics (GA4) | Traffic analytics + conversions | Inline in HTML |
| Google reCAPTCHA | Form spam protection | Contact form pages |

## Third-Party Frontend Libraries

Loaded via CDN or bundled in `core.min.js`:
- **jQuery 3.3.1** — DOM manipulation
- **Bootstrap 3/4** — Grid, components, responsive layout
- **Owl Carousel** — Image/content sliders
- **WOW.js** — Scroll-triggered animations
- **Light Gallery** — Image lightbox/gallery
- **Isotope.js** — Filtering and masonry layouts
- **Regula.js** — Form validation
- **RD Navbar** — Responsive navigation

## Development Notes

### No Build Process
There is no build step, bundler, or transpilation. Edit HTML/CSS/JS files directly and they are served as-is. There is no `package.json`, no npm scripts, and no test suite.

### Working with HTML Pages
- Many pages share the same header/footer HTML (duplicated, not templated)
- When updating navigation, header, or footer, changes must be applied to **all** HTML files manually
- City-specific pages (`bangalore.html`, `chennai.html`, etc.) follow the same template structure with route-specific content

### CSS
- All custom styles are in `css/style.css` (~19,000 lines)
- Uses class-based selectors following the template's conventions
- Bootstrap utility classes used throughout HTML

### Adding New City Pages
1. Copy an existing city page (e.g., `bangalore.html`)
2. Update route-specific content (popular routes, distances, pricing)
3. Update city name references throughout
4. Add navigation links in all pages

### Modifying Pricing
- Update rate constants in `js/map.js` inside the `calcRoute()` function
- Sedan one-way: line 56, Round: line 57
- Prime Sedan one-way: line 58, Round: line 59
- SUV one-way: line 60, Round: line 61
- Prime SUV one-way: line 62, Round: line 63
- Traveller: line 64

## Security Considerations

**Known issues to be aware of:**
- API keys and tokens are embedded in client-side JavaScript (Telegram bot token, Fast2SMS auth key, Google Maps API key)
- PHP form handlers use `$_POST` values directly in email bodies without sanitization
- No CSRF protection on form submissions
- No server-side rate limiting

**When making changes:**
- Do not add additional secrets to client-side code
- Avoid introducing XSS vulnerabilities in any dynamic content
- Validate and sanitize any user input before use

## Contact Information (Hardcoded in Pages)

- Phone: 99409 80956, 97894 95183
- Email: droptaxiindia21@gmail.com
- Business name: Drop Taxi India

## Git Conventions

- Commit messages follow the pattern: `Update <filename>` for single-file changes
- The `main` branch is deployed to GitHub Pages
- No CI/CD pipeline — pushes to main deploy directly via GitHub Pages
