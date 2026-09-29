# CaMoim — Korean Business Map: Design Doc

Written: 2026-07-08 · Status: **shipped** (see "What actually shipped" at the end)

## 1. Overview

Add map-based discovery inside CaMoim so Korean residents of Canada (students,
immigrants, working-holiday visa holders) can find Korean-run businesses nearby.
Scope is not limited to restaurants: cafés and bakeries, grocery stores, hair
salons, clinics, and real-estate/immigration services are all in.

## 2. Scope

- **Categories**: restaurant, café/bakery, grocery, hair salon, clinic,
  real-estate & immigration services, other
- **Launch cities**: start with the metros where Korean students and residents
  cluster (Toronto, Vancouver, Montreal), then expand
- **MVP**: map/list browsing, business detail, bookmarks, user submissions,
  reporting. Reviews and star ratings deferred to a second iteration.

## 3. Data acquisition

Three sources combined:

1. **Google Places API scrape** — search per city for keywords like "Korean
   restaurant", "Korean grocery", "Korean hair salon" to seed initial data.
   Seeded as `source: google`, `status: approved`, reusing the `seedUniversities`
   script pattern from the University model.
2. **Admin entry** — add CRUD to the admin screens so operators can create and
   edit listings directly.
3. **User submissions with approval** — an "suggest a business" button files a
   listing as `status: pending`; an admin approves or rejects it. This reuses the
   `pending_review` flow already built for Groups.

## 4. Data model (`server/models/Business.js`)

| Field | Type | Notes |
|---|---|---|
| name | String | Business name |
| category | String (enum) | restaurant / café / grocery / salon / clinic / realestate-immigration / other |
| city | String | Used as the filter key |
| address | String | Full address |
| location | GeoJSON Point | `{ type: 'Point', coordinates: [lng, lat] }`, 2dsphere index |
| phone | String | Optional |
| hours | String | Optional |
| images | [String] | Cloudinary URLs, folder `camoim/businesses` |
| source | String (enum) | `google` \| `admin` \| `user` |
| status | String (enum) | `pending` \| `approved` \| `rejected` |
| submittedBy | ObjectId (User) | Set on user submissions |
| bookmarkCount | Number | Optional, used for sorting |

Business bookmarks reuse the existing `Bookmark` model as-is, and closure or
bad-data reports reuse the existing `Report` model.

## 5. Screens (frontend)

- **Map home** — city dropdown at the top, category filter chips, per-category
  pins on the map (with clustering), a list/map toggle at the bottom, and a
  "near me" button
- **Business detail** — hero photo, name, category badge, address, phone, hours,
  bookmark button, directions button (deep-links to the device map app), report
  button
- **Submit a business** — form for name, category, address, photo, phone
- **Admin** — business list including the pending-approval queue; create, edit,
  delete; approve or reject submissions

New libraries: `react-native-maps`, plus `expo-location` for location permission.

## 6. Backend API

- `GET /api/businesses?city=&category=&near=lng,lat` — list (geospatial `$near` query)
- `GET /api/businesses/:id` — detail
- `POST /api/businesses` — user submission (`status: pending`)
- `PUT /api/admin/businesses/:id` — admin edit / approve / reject
- `DELETE /api/admin/businesses/:id` — admin delete
- `POST /api/businesses/:id/report` — report (reuses the existing Report route)

## 7. QA checkpoints

- Verify the closure / bad-data report handling flow
- Fall back to manual city selection when location permission is denied
- Spam-proof user submissions (approval queue, duplicate detection)
- Confirm Google Places terms of service and attribution requirements
- Validate performance (clustering) as pin density grows

## 8. Roadmap

- **Phase 1** — Business model, API, admin CRUD; seed Toronto/Vancouver/Montreal
  from Google Places
- **Phase 2** — map and list screens, bookmark integration
- **Phase 3** — open user submissions
- **Phase 4** — more cities; revisit reviews and star ratings

## What actually shipped

The feature went live with roughly this shape, and phase 4 landed earlier than
planned:

- ~580 seeded pins across the launch cities
- Reviews and star ratings **did** ship (`server/models/BusinessReview.js`,
  with `ratingAvg` / `ratingCount` denormalized onto `Business`), rather than
  staying deferred
- Bookmarks got a dedicated model (`BusinessBookmark.js`) instead of reusing the
  generic `Bookmark` model — business bookmarks needed their own counters and
  query patterns
- A weekly ranking surface was added (`BusinessWeeklyStat.js`), which was not in
  this plan at all
- `react-native-maps` required a local patch to avoid a crash; see
  `patches/react-native-maps+1.20.1.patch`
