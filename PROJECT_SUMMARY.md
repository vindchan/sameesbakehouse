# Samee's Bakehouse Website - Project Summary

## ✅ Completed Tasks

### Website Setup
- Created single HTML file website (index.html)
- Set up GitHub Pages hosting (free)
- Connected custom domain: sameessbakehouse.com
- Made repository public for free hosting

### Content & Design
- Added business name: "Samee's Bakehouse"
- Added tagline: "Bespoke. Fresh. Flavour Forward"
- Added Sameeksha's photo and bio
- Added contact info: +91-9711200398, Kumara Park East, Bengaluru
- Added social media links (Instagram, WhatsApp catalog, WhatsApp DM, Feedback form)

### Visual Design
- Applied brand color palette:
- Used Source Sans Pro for brand name
- Used Source Serif Pro for headings
- Made logo round with transparent background
- Added custom social media icons

### Technical
- Mobile-responsive design
- Clean, professional layout
- Fast loading (single HTML file)
- SEO-friendly structure

## 🎯 Final Result
Live website at: sameessbakehouse.com
- Professional bakery website
- Easy to update
- Free hosting
- Custom domain

## 🧁 Dynamic Menu (Google Sheets + Cloudinary)
- Menu page: `/menu/` pulls items from a published Google Sheet via JSONP.
- Sheet columns supported (case-insensitive): Category, Item, Description, Price, Available, Image URL.
- To update the menu: edit the sheet and the site reflects changes automatically.
- Images: upload to Cloudinary (free), copy the Secure URL, and paste into the Image URL column.
- Order button: global "Order Now" links to WhatsApp.

Setup notes
- Sheet must be File → Share → Publish to the web (entire document) for the JSON feed to load.
- Configure the page in `menu/index.html` inside the `<script id="menu-config">` tag:
  - `data-sheet-id`: your Google Sheet ID
  - `data-gid`: tab gid (usually 0)
  - `data-whatsapp-link`: your WhatsApp link
