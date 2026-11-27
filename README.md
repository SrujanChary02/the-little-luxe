# The Little LUXE

Website for The Little LUXE — everyday accessories & jewelry.
Live at **https://srujanchary02.github.io/the-little-luxe/**

Everything you'd normally change lives in **`products.js`**: contact details, shipping prices,
products and reviews.

---

## 1. Turn on ordering (do this first)

At the top of `products.js`:

| Setting | What it does |
|---|---|
| `whatsapp` | Your number with country code, e.g. `"919876543210"`. Order buttons and the bag's **Send order** send customers to your WhatsApp with the full order written out. |
| `instagram` | Your handle without the @. Adds a "Follow on Instagram" button. |
| `email` | Shown on the Policies page. |
| `upiId` | Adds **Pay ₹… by UPI** to the bag (opens GPay/PhonePe/Paytm with the amount filled in) and a QR code for computers. Use a **business UPI ID** (PhonePe Business, Paytm for Business, GPay for Business) — some apps block "pay" links to personal UPI IDs. |
| `cashOnDelivery` | `true` shows "Cash on delivery available" in the FAQ. |

Until `whatsapp` or `instagram` is filled in, the site says **"Ordering opens soon"** instead of
taking orders.

## 2. Shipping, gifts & policies

Also in `products.js`: `freeShippingAbove`, `shippingFee`, `giftWrapPrice`, `budgetPrice`
(the "Under ₹…" filter), `dispatchDays`, `deliveryDays`, `returnDays`.
These numbers update the announcement bar, the bag, the FAQ and the Policies page automatically.

**Please read `policies.html` once** and change anything that doesn't match how you work —
they're sensible defaults, not legal advice.

## 3. Posting new jewelry

### Option A — edit `products.js`
1. Add photos to the `images/` folder.
2. Copy a product block, change the details, and list the photos:
   `images: ["images/pearl-hoops-1.jpg", "images/pearl-hoops-2.jpg"]`
3. Commit and push — the site updates in about a minute.

**Photo names:** use lowercase with dashes (e.g. `pearl-hoops-1.jpg`) and type them exactly the
same in `products.js`. The live site treats `Photo.JPG` and `photo.jpg` as different files. If a
photo can't be found, the site shows the placeholder drawing instead. Square-ish photos around
1200px wide and under 300 KB keep the site fast.

### Option B — run products from a Google Sheet (edit from your phone)
1. Go to Google Sheets → **File → Import → Upload** → choose `products-template.csv`.
2. Put your photos in a Google Drive folder and set it to **Anyone with the link can view**.
   For each product, paste the photos' share links into the `images` column, separated by ` | `.
3. In the sheet: **File → Share → Publish to web** → choose the sheet and **Comma-separated
   values (.csv)** → **Publish**, and copy the link.
4. Paste that link into `productsSheet` in `products.js`, commit and push (one time only).

From then on, edit the sheet and the site updates within about 5 minutes. Columns:
`id, name, category, price, oldPrice, images, description, isNew, soldOut`
(`isNew` / `soldOut`: write `yes` or leave empty). If the sheet can't be loaded, the site falls
back to the products in `products.js`.

## 4. Reviews

Add real customer reviews (with their permission) to `REVIEWS` at the bottom of `products.js`.
The "Kind words" section appears automatically once there's at least one.

## 5. Your own domain, Google & visitor stats

- **Domain:** buy one (e.g. `shopthelittleluxe.com` or `thelittleluxe.co.in`). In your
  registrar's DNS settings add four `A` records for `@` pointing to `185.199.108.153`,
  `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` record for `www`
  pointing to `srujanchary02.github.io`. Then in GitHub → repo **Settings → Pages → Custom
  domain**, enter your domain and tick **Enforce HTTPS**. Finally, replace
  `srujanchary02.github.io/the-little-luxe` with your domain in `index.html`, `policies.html`,
  `sitemap.xml` and `robots.txt`.
- **Google Search:** add the site in [Google Search Console](https://search.google.com/search-console)
  and submit `sitemap.xml`. (`robots.txt` only takes effect once you're on your own domain.)
- **Google Maps / Business Profile:** create one at [business.google.com](https://business.google.com)
  and link your website — free and great for local customers.
- **Visitor stats:** sign up free at [goatcounter.com](https://www.goatcounter.com), pick a code,
  and put it in `statsCode` in `products.js`. No cookie banner needed.

## 6. Wishlist, customer accounts & the shop manager

- **Wishlist** (♡ on every piece) and the remembered name/address in the bag work right away —
  they're saved on the shopper's device.
- **Sign in, customer accounts and the shop manager (`admin.html`)** run on AWS in the personal
  account (327712415896, Mumbai `ap-south-1`): Cognito for sign-in, a Lambda function for the
  API, DynamoDB for profiles/wishlists/orders, and a private S3 bucket behind CloudFront for
  photos and the product list. Everything is defined in `aws/template.yaml`.

**Deploy / update** (needs the `funny-shorts` AWS profile; the script refuses any other account):

```bash
bash aws/deploy.sh
```

It creates or updates the `tll-shop` stack, uploads `aws/api/index.mjs`, and writes the four
`aws` values into `products.js`. Commit and push to put sign-in live.

**Make yourself the owner:** sign up on the website with your email, then run
`bash aws/make-owner.sh you@example.com`, sign out and back in. "Manage the shop" appears in
your account, or go straight to `/admin.html`.

**Shop manager:** add/edit/reorder/delete products, upload photos from your phone (they're
resized automatically), tick New / Sold out, and update order status. As soon as you add your
first product there, the shop uses those products instead of `products.js`.

**Costs (small shop):** Cognito is free up to 10,000 monthly users; Lambda and CloudFront are
within the always-free tier; DynamoDB and S3 cost a few rupees a month at most.
Customer accounts, the table and the photo bucket are kept even if the stack is deleted.

## Logo & brand files

See the `brand/` folder (open `brand/index.html` for the full kit). To re-export the logo files
after a change, run `bash brand/src/render.sh` (needs Google Chrome).
