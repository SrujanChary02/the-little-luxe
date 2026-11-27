// =====================================================================
//  THE LITTLE LUXE — YOUR STORE SETTINGS, PRODUCTS & REVIEWS
//  This is the only file you need to edit to run the shop.
// =====================================================================

window.STORE = {
  name: "The Little LUXE",
  currency: "₹",

  // ----- How customers reach you & pay (leave "" until you have them) -----
  whatsapp: "",        // your WhatsApp number with country code, e.g. "919876543210"
  instagram: "",       // your Instagram handle without the @
  email: "",           // shown on the Policies page, e.g. "hello@thelittleluxe.co.in"
  upiId: "",           // your UPI ID, e.g. "yourname@okaxis" — adds a "Pay by UPI" button at checkout
  // Until WhatsApp or Instagram is filled in, the site shows "Ordering opens soon".

  // ----- Shipping, gifts & policies (used across the site and Policies page) -----
  freeShippingAbove: 999,  // orders at or above this get free shipping
  shippingFee: 79,         // shipping charge for smaller orders
  giftWrapPrice: 49,       // set to 0 to make gift wrapping free
  budgetPrice: 499,        // the "Under ₹499" filter
  dispatchDays: "2–4",     // working days to dispatch
  deliveryDays: "4–8",     // working days for delivery after dispatch
  returnDays: 7,           // days to report a damaged/wrong item
  cashOnDelivery: false,   // true if you offer COD

  // ----- Optional: run your product list from a Google Sheet -----
  // Paste the "Publish to web → CSV" link here and the site will load products from the sheet.
  // Leave "" to use the PRODUCTS list below. See README.md for the 2-minute setup.
  productsSheet: "",

  // ----- Optional: free, private visitor stats from goatcounter.com -----
  // Sign up, pick a code (e.g. "thelittleluxe"), and put it here. Leave "" for no stats.
  statsCode: "",

  // ----- Sign-in, customer accounts & the owner page (AWS) -----
  // Filled in by aws/deploy.sh. Leave empty to turn accounts off (the wishlist still works).
  aws: {
    authDomain: "https://thelittleluxe-shop.auth.ap-south-1.amazoncognito.com",   // Cognito sign-in page address
    clientId: "c0gjimc82qdfh053f3o8k4s28",     // Cognito app client id (public, safe to share)
    apiUrl: "https://oue3go3du4ahlp4fsekgjs7bve0fuzal.lambda-url.ap-south-1.on.aws",       // the shop's API address
    cdnUrl: "https://d1zm4a7bfl396u.cloudfront.net",       // where product photos and the product list are served from
  },
};

// ---------------------------------------------------------------------
//  HOW TO POST A NEW PIECE
//  1. Put the photos in the "images" folder (e.g. images/pearl-hoops-1.jpg)
//  2. Copy one block below { ... }, paste it at the top of the list,
//     and change the details.
//  3. Save, commit and push — it's live in about a minute.
//
//  Fields:
//    id          unique number (just use the next number)
//    name        product name
//    category    Earrings / Necklaces / Rings / Bracelets / Anklets / Gift Sets (or any new one)
//    price       selling price (number)
//    oldPrice    optional — original price, shows as "Sale"
//    images      list of photos, first one is the main photo:
//                ["images/pearl-hoops-1.jpg", "images/pearl-hoops-2.jpg"]
//                (leave [] to show a placeholder drawing)
//    description short description
//    isNew       true = appears in "New In"
//    soldOut     true = shows "Sold out" and can't be added to the bag
// ---------------------------------------------------------------------

window.PRODUCTS = [
  {
    id: 1,
    name: "Pearl Drop Huggies",
    category: "Earrings",
    price: 499,
    images: [],
    description: "Tiny gold-tone huggie hoops with a single freshwater-style pearl. Light enough to sleep in.",
    isNew: true,
  },
  {
    id: 2,
    name: "Dainty Initial Pendant",
    category: "Necklaces",
    price: 699,
    oldPrice: 899,
    images: [],
    description: "A delicate chain with a minimal letter charm. Make it yours — mention your initial when ordering.",
    isNew: true,
  },
  {
    id: 3,
    name: "Stackable Twist Ring",
    category: "Rings",
    price: 349,
    images: [],
    description: "A slim twisted band made for stacking. Adjustable fit, anti-tarnish finish.",
    isNew: true,
  },
  {
    id: 4,
    name: "Evil Eye Chain Bracelet",
    category: "Bracelets",
    price: 449,
    images: [],
    description: "A fine chain bracelet with a tiny blue evil-eye charm for everyday good vibes.",
    isNew: true,
  },
  {
    id: 10,
    name: "Everyday Essentials Gift Set",
    category: "Gift Sets",
    price: 1199,
    oldPrice: 1347,
    images: [],
    description: "Pearl Drop Huggies, the Stackable Twist Ring and the Evil Eye Bracelet together in our signature gift box.",
  },
  {
    id: 5,
    name: "Butterfly Studs",
    category: "Earrings",
    price: 299,
    images: [],
    description: "Petite butterfly studs with a soft gold shine. The perfect everyday pair.",
  },
  {
    id: 6,
    name: "Layered Satellite Necklace",
    category: "Necklaces",
    price: 799,
    images: [],
    description: "Two delicate layers — a beaded satellite chain and a plain fine chain — in one piece.",
  },
  {
    id: 7,
    name: "Heart Charm Anklet",
    category: "Anklets",
    price: 399,
    images: [],
    description: "A dainty anklet with tiny dangling hearts. Summer-ready and water-friendly.",
  },
  {
    id: 8,
    name: "Minimal Cuff Bangle",
    category: "Bracelets",
    price: 599,
    images: [],
    description: "An open cuff with a sleek polished finish. Goes with everything.",
    soldOut: true,
  },
  {
    id: 9,
    name: "Crystal Solitaire Ring",
    category: "Rings",
    price: 449,
    oldPrice: 549,
    images: [],
    description: "A single sparkling crystal on a thin band — everyday luxe, no occasion needed.",
  },
];

// ---------------------------------------------------------------------
//  CUSTOMER REVIEWS
//  Add real reviews from customers here (with their permission).
//  The "Loved by you" section stays hidden until there is at least one.
//  Example:
//    { name: "Priya", city: "Hyderabad", rating: 5, text: "So dainty! I haven't taken them off." },
// ---------------------------------------------------------------------

window.REVIEWS = [
];
