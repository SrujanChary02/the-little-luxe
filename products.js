// =====================================================================
//  THE LITTLE LUXE — YOUR STORE SETTINGS & PRODUCTS
//  This is the only file you need to edit to post new jewelry.
// =====================================================================

window.STORE = {
  name: "The Little LUXE",
  currency: "₹",
  whatsapp: "",               // ← your WhatsApp number with country code, e.g. "919876543210"
  instagram: "",              // ← your Instagram handle without the @ (leave empty until you create one)
  // Until at least one of these is filled in, the site shows "Ordering opens soon" instead of order buttons.
};

// ---------------------------------------------------------------------
//  HOW TO POST A NEW PIECE
//  1. Put the photo in the "images" folder (e.g. images/pearl-hoops.jpg)
//  2. Copy one block below { ... }, paste it at the top of the list,
//     and change the details.
//  3. Save. Refresh the page — it's live.
//
//  Fields:
//    id          unique number (just use the next number)
//    name        product name
//    category    Earrings / Necklaces / Rings / Bracelets / Anklets (or any new one)
//    price       selling price (number)
//    oldPrice    optional — original price, shows as "Sale"
//    image       "images/your-photo.jpg"  (leave "" to show a placeholder)
//    description short description
//    isNew       true = appears in "New In"
//    soldOut     true = shows "Sold out"
// ---------------------------------------------------------------------

window.PRODUCTS = [
  {
    id: 1,
    name: "Pearl Drop Huggies",
    category: "Earrings",
    price: 499,
    image: "",
    description: "Tiny gold-tone huggie hoops with a single freshwater-style pearl. Light enough to sleep in.",
    isNew: true,
  },
  {
    id: 2,
    name: "Dainty Initial Pendant",
    category: "Necklaces",
    price: 699,
    oldPrice: 899,
    image: "",
    description: "A delicate chain with a minimal letter charm. Make it yours — mention your initial when ordering.",
    isNew: true,
  },
  {
    id: 3,
    name: "Stackable Twist Ring",
    category: "Rings",
    price: 349,
    image: "",
    description: "A slim twisted band made for stacking. Adjustable fit, anti-tarnish finish.",
    isNew: true,
  },
  {
    id: 4,
    name: "Evil Eye Chain Bracelet",
    category: "Bracelets",
    price: 449,
    image: "",
    description: "A fine chain bracelet with a tiny blue evil-eye charm for everyday good vibes.",
    isNew: true,
  },
  {
    id: 5,
    name: "Butterfly Studs",
    category: "Earrings",
    price: 299,
    image: "",
    description: "Petite butterfly studs with a soft gold shine. The perfect everyday pair.",
  },
  {
    id: 6,
    name: "Layered Satellite Necklace",
    category: "Necklaces",
    price: 799,
    image: "",
    description: "Two delicate layers — a beaded satellite chain and a plain fine chain — in one piece.",
  },
  {
    id: 7,
    name: "Heart Charm Anklet",
    category: "Anklets",
    price: 399,
    image: "",
    description: "A dainty anklet with tiny dangling hearts. Summer-ready and water-friendly.",
  },
  {
    id: 8,
    name: "Minimal Cuff Bangle",
    category: "Bracelets",
    price: 599,
    image: "",
    description: "An open cuff with a sleek polished finish. Goes with everything.",
    soldOut: true,
  },
  {
    id: 9,
    name: "Crystal Solitaire Ring",
    category: "Rings",
    price: 449,
    oldPrice: 549,
    image: "",
    description: "A single sparkling crystal on a thin band — everyday luxe, no occasion needed.",
  },
];
