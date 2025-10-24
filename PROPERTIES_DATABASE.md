# Properties Database Documentation

This document describes the structure and content of the sample properties data for AuraStays.

## Overview

Total Properties: **20**

- **Homes**: 12 properties
- **Experiences**: 5 properties
- **Services**: 3 properties

## Database Structure

All properties are stored in the `properties` collection in Firestore with the following structure:

### Common Fields (All Categories)

```javascript
{
  id: string,                    // Unique identifier (prop_XXX, exp_XXX, srv_XXX)
  category: string,              // "home" | "experience" | "service"
  title: string,                 // Property title
  description: string,           // Detailed description
  location: {
    address: string,
    city: string,
    province: string,
    country: string,
    zipCode: string,
    coordinates: {
      latitude: number,
      longitude: number
    }
  },
  pricing: object,               // Varies by category
  images: string[],              // Array of image URLs
  rating: number,                // 0-5 rating
  reviewsCount: number,          // Number of reviews
  status: string,                // "active" | "inactive"
  createdAt: string,             // ISO date string
  featured: boolean,             // Featured listing
  cancellationPolicy: string,    // "Flexible" | "Moderate" | "Strict"
}
```

---

## 🏠 HOMES (12 Properties)

### 1. Luxury Beachfront Villa in Boracay (prop_001)

- **Type**: Villa
- **Location**: Station 1, White Beach, Boracay
- **Capacity**: 8 guests, 4 bedrooms, 5 beds, 3 bathrooms
- **Price**: ₱15,000/night + ₱2,000 cleaning + ₱1,500 service
- **Amenities**: WiFi, AC, Private Pool, Beach Access, Kitchen, etc.
- **Rating**: 4.9 (127 reviews)
- **Featured**: Yes

### 2. Modern Condo in BGC with City View (prop_002)

- **Type**: Condo
- **Location**: 26th Street, Bonifacio Global City, Taguig
- **Capacity**: 4 guests, 2 bedrooms, 2 beds, 2 bathrooms
- **Price**: ₱4,500/night + ₱500 cleaning + ₱450 service
- **Amenities**: WiFi, AC, Kitchen, Gym, Pool, Parking, etc.
- **Rating**: 4.7 (89 reviews)
- **Featured**: No

### 3. Cozy Mountain Cabin in Tagaytay (prop_003)

- **Type**: Cabin
- **Location**: Maharlika East, Tagaytay City, Cavite
- **Capacity**: 4 guests, 2 bedrooms, 2 beds, 1 bathroom
- **Price**: ₱3,500/night + ₱800 cleaning + ₱350 service
- **Amenities**: WiFi, Fireplace, Kitchen, Mountain/Lake View, etc.
- **Rating**: 4.8 (156 reviews)
- **Featured**: Yes

### 4. Heritage House in Vigan (prop_004)

- **Type**: House
- **Location**: Calle Crisologo, Vigan City, Ilocos Sur
- **Capacity**: 6 guests, 3 bedrooms, 4 beds, 2 bathrooms
- **Price**: ₱5,000/night + ₱1,000 cleaning + ₱500 service
- **Amenities**: WiFi, AC, Kitchen, Garden, Historic Property, etc.
- **Rating**: 4.9 (203 reviews)
- **Featured**: Yes

### 5. Beachfront Bungalow in Siargao (prop_005)

- **Type**: Bungalow
- **Location**: Cloud 9, General Luna, Surigao del Norte
- **Capacity**: 2 guests, 1 bedroom, 1 bed, 1 bathroom
- **Price**: ₱3,000/night + ₱500 cleaning + ₱300 service
- **Amenities**: WiFi, Beach Access, Outdoor Shower, Eco-Friendly, etc.
- **Rating**: 4.6 (74 reviews)
- **Featured**: No

### 6. Penthouse Suite in Makati (prop_006)

- **Type**: Penthouse
- **Location**: Ayala Avenue, Makati City, Metro Manila
- **Capacity**: 6 guests, 3 bedrooms, 3 beds, 3 bathrooms
- **Price**: ₱12,000/night + ₱2,000 cleaning + ₱1,200 service
- **Amenities**: WiFi, AC, Kitchen, Rooftop Terrace, Gym, Pool, Jacuzzi, etc.
- **Rating**: 4.9 (145 reviews)
- **Featured**: Yes

### 7. Traditional Nipa Hut in Palawan (prop_007)

- **Type**: Nipa Hut
- **Location**: Poblacion, El Nido, Palawan
- **Capacity**: 2 guests, 1 bedroom, 1 bed, 1 bathroom
- **Price**: ₱2,000/night + ₱300 cleaning + ₱200 service
- **Amenities**: WiFi, Fan, Garden, Rice Paddy View, Cultural Experience, etc.
- **Rating**: 4.8 (92 reviews)
- **Featured**: No

### 8. Lakeside Cottage in Laguna (prop_008)

- **Type**: Cottage
- **Location**: Lakeshore Drive, Calamba, Laguna
- **Capacity**: 6 guests, 3 bedrooms, 4 beds, 2 bathrooms
- **Price**: ₱4,000/night + ₱700 cleaning + ₱400 service
- **Amenities**: WiFi, AC, Kitchen, Lake Access, Private Dock, Kayaks, etc.
- **Rating**: 4.7 (58 reviews)
- **Featured**: No

### 9. Art Deco Apartment in Manila (prop_009)

- **Type**: Apartment
- **Location**: Remedios Street, Malate, Manila
- **Capacity**: 2 guests, 1 bedroom, 1 bed, 1 bathroom
- **Price**: ₱3,500/night + ₱600 cleaning + ₱350 service
- **Amenities**: WiFi, AC, Kitchen, Historic Building, High Ceilings, etc.
- **Rating**: 4.8 (112 reviews)
- **Featured**: No

### 10. Farm Stay in Baguio (prop_010)

- **Type**: Farmstay
- **Location**: La Trinidad Valley, Benguet, Baguio
- **Capacity**: 4 guests, 2 bedrooms, 2 beds, 1 bathroom
- **Price**: ₱2,500/night + ₱400 cleaning + ₱250 service
- **Amenities**: WiFi, Fireplace, Kitchen, Farm Tour, Fresh Produce, etc.
- **Rating**: 4.9 (167 reviews)
- **Featured**: Yes

### 11. Floating House in Coron (prop_011)

- **Type**: Floating House
- **Location**: Coral Bay, Coron Island, Palawan
- **Capacity**: 2 guests, 1 bedroom, 1 bed, 1 bathroom
- **Price**: ₱6,000/night + ₱800 cleaning + ₱600 service
- **Amenities**: Ocean View, Snorkeling Equipment, Kayak, Solar Power, etc.
- **Rating**: 4.9 (85 reviews)
- **Featured**: Yes

### 12. Studio Loft in Cebu IT Park (prop_012)

- **Type**: Studio
- **Location**: Apas, Cebu IT Park, Cebu City
- **Capacity**: 2 guests, 1 bedroom, 1 bed, 1 bathroom
- **Price**: ₱2,800/night + ₱400 cleaning + ₱280 service
- **Amenities**: Fiber WiFi, AC, Workspace, Standing Desk, Gym, Pool, etc.
- **Rating**: 4.6 (43 reviews)
- **Featured**: No

---

## ✨ EXPERIENCES (5 Properties)

### 1. Island Hopping Adventure in El Nido (exp_001)

- **Type**: Water Activity
- **Duration**: 8 hours (8:00 AM - 4:00 PM)
- **Capacity**: 4-15 guests
- **Price**: ₱1,800 per person
- **Includes**: Boat, snorkeling gear, lunch, guide, entrance fees
- **What to Expect**: Visit 4-5 islands, snorkeling, swimming, BBQ lunch, kayaking
- **Languages**: English, Filipino
- **Rating**: 4.9 (342 reviews)
- **Featured**: Yes

### 2. Filipino Cooking Class in Manila (exp_002)

- **Type**: Culinary
- **Duration**: 4 hours (9:00 AM - 1:00 PM)
- **Capacity**: 2-8 guests
- **Price**: ₱2,500 per person
- **Includes**: Market tour, ingredients, instruction, meal, recipe booklet, apron
- **What to Expect**: Market visit, cook 4 dishes (adobo, sinigang, lumpia, halo-halo)
- **Languages**: English, Filipino
- **Rating**: 4.9 (198 reviews)
- **Featured**: Yes

### 3. Sunrise Trek to Mount Pinatubo (exp_003)

- **Type**: Adventure
- **Duration**: 10 hours (3:00 AM - 1:00 PM)
- **Capacity**: 5-20 guests
- **Price**: ₱3,200 per person
- **Includes**: 4x4 ride, guide, entrance fee, breakfast, snacks, water
- **What to Expect**: 4x4 through lahar, 2-3 hour trek, sunrise at crater, swimming
- **Languages**: English, Filipino
- **Rating**: 4.8 (276 reviews)
- **Featured**: Yes

### 4. Street Food Tour in Binondo Manila (exp_004)

- **Type**: Food Tour
- **Duration**: 3 hours (10:00 AM - 1:00 PM)
- **Capacity**: 4-12 guests
- **Price**: ₱1,500 per person
- **Includes**: Guide, 10+ tastings, drinks, historical tour, food map
- **What to Expect**: Visit 8-10 stalls, Chinese-Filipino fusion, Chinatown history
- **Languages**: English, Filipino, Chinese
- **Rating**: 4.7 (164 reviews)
- **Featured**: No

### 5. Whale Shark Swimming in Oslob (exp_005)

- **Type**: Wildlife
- **Duration**: 3 hours (6:00 AM - 9:00 AM)
- **Capacity**: 1-6 guests
- **Price**: ₱2,000 per person
- **Includes**: Boat, snorkeling gear, life vest, breakfast, briefing, viewing fee
- **What to Expect**: Swim with whale sharks, 30 min water time, breakfast
- **Languages**: English, Filipino
- **Rating**: 4.9 (412 reviews)
- **Featured**: Yes

---

## 🛎️ SERVICES (3 Properties)

### 1. Professional Photography & Videography (srv_001)

- **Type**: Photography
- **Service Area**: Nationwide (all major tourist destinations)
- **Duration**: 2-10 hours (flexible)
- **Packages**:
  - Basic (2h): ₱5,000 - 50 edited photos
  - Premium (4h): ₱10,000 - 100 photos + 5min video
  - Full Day (8h): ₱18,000 - 200+ photos + 10min video
- **Includes**: Photographer, equipment, editing, online gallery, digital download
- **Equipment**: Sony A7IV, Canon R5, Drone (premium), Gimbal
- **Rating**: 4.9 (234 reviews)
- **Featured**: Yes

### 2. Private Airport Transfer & Car Rental (srv_002)

- **Type**: Transportation
- **Service Area**: Metro Manila, Tagaytay, Batangas, Pampanga, Subic
- **Duration**: Per booking (1 hour to full day)
- **Rates**:
  - Sedan (4 pax): Airport ₱1,500 | Half Day ₱3,500 | Full Day ₱6,000
  - SUV (6 pax): Airport ₱2,000 | Half Day ₱4,500 | Full Day ₱7,500
  - Van (10 pax): Airport ₱2,500 | Half Day ₱5,500 | Full Day ₱9,000
- **Includes**: Driver, fuel, tolls, parking, airport assistance, water
- **Vehicles**: Toyota Vios, Fortuner, Hiace (2020+)
- **Availability**: 24/7
- **Rating**: 4.8 (567 reviews)
- **Featured**: Yes

### 3. Personal Travel Concierge & Trip Planning (srv_003)

- **Type**: Travel Planning
- **Service Area**: All Philippines destinations (Virtual service)
- **Duration**: 3-7 days planning + trip support
- **Packages**:
  - Essential (3-5 days): ₱3,000 - Basic itinerary, recommendations
  - Complete (7-10 days): ₱6,000 - Detailed itinerary, bookings, 24/7 support
  - Premium Concierge: ₱12,000 - Full planning, VIP experiences, personal assistance
- **Includes**: Consultation, custom itinerary, bookings, support, travel guide
- **Expertise**: 10+ years, budget to luxury, family/adventure specialist
- **Rating**: 4.9 (178 reviews)
- **Featured**: Yes

---

## How to Seed the Database

1. **Go to Admin Dashboard**: Navigate to `/admin`
2. **Find "Database Management" section**: Located below the statistics cards
3. **Click "Seed X Properties to Firebase"**: This will add all properties to Firestore
4. **Confirm**: A confirmation dialog will appear
5. **Wait**: Progress bar shows seeding progress (0-100%)
6. **Done**: Toast notification confirms successful seeding

## Firebase Collection Structure

```
Firestore
└── properties/
    ├── prop_001 (Luxury Villa Boracay)
    ├── prop_002 (BGC Condo)
    ├── ...
    ├── exp_001 (El Nido Island Hopping)
    ├── ...
    └── srv_001 (Photography Service)
```

## Future Enhancements

- [ ] Add more property types (Boats, RVs, Unique stays)
- [ ] Add seasonal pricing
- [ ] Add real-time availability calendar
- [ ] Add booking system integration
- [ ] Add review management
- [ ] Add host management dashboard
- [ ] Add property analytics
- [ ] Add search and filtering
- [ ] Add favorites/wishlist integration
- [ ] Add booking history

## Notes

- All images use Unsplash placeholder URLs
- All prices are in Philippine Peso (PHP)
- Coordinates are approximate for each location
- All properties are marked as "active"
- Featured properties appear first in listings
- Sample data is production-ready and can be used immediately

---

Last Updated: October 24, 2025
