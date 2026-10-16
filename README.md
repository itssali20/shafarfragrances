# Shafar Fragrances: website, shop backend and admin dashboard

The approved pages, a small backend (Vercel functions in `api/`) and the admin dashboard at `/admin`. There is no build step: upload the folder as it is.

## Pages

| File | Page |
|---|---|
| `index.html` | Featured (the page the site opens on) |
| `home.html` | Home |
| `about.html` | About |
| `shop.html` | Shop. `shop.html#men`, `#women` and `#unisex` open it on that category |
| `product.html` | Product page template. `product.html#belford` opens that fragrance |
| `contact.html` | Contact |
| `checkout.html` | Checkout (cash on delivery) |
| `account.html` | Customer account: sign in, create an account, and the customer's own dashboard |
| `admin.html` | Admin dashboard, at `/admin` |

`vercel.json` turns on clean addresses, so on Vercel the pages show as `/home`, `/shop`, `/about` and so on.

## Put it on Vercel

**1. Upload**
- With GitHub: create a repository, upload everything inside this folder, then in Vercel choose Add New > Project and import it. Framework preset: Other. Leave the build command and output directory empty. Deploy.
- Or with the Vercel CLI: `npm i -g vercel`, then run `vercel` and `vercel --prod` in this folder.

Updating an existing project: replace the files in the repository with these and push, or run `vercel --prod` again.

**2. Connect the database (one time)**
1. In your Vercel project open **Storage** and choose **Create Database**, then **Neon** (Serverless Postgres). Accept the terms, pick the region closest to Pakistan (Singapore or Mumbai if offered), choose the Free plan and name the database. Then **Connect Project**, tick all environments, leave the prefix empty and press **Connect**. Vercel adds `DATABASE_URL` for you.
2. Open **Settings > Environment Variables** and add `ADMIN_PASSWORD` with a strong password. This is the dashboard password.
3. Open **Deployments** and **Redeploy** the latest deployment so it picks up both.

**2b. Switch on email (one time)**
Order confirmations, new-order alerts, account emails and Loyal codes are sent through [Resend](https://resend.com) (free for 3,000 emails a month).
1. Make a Resend account, add your domain (for example shafarfragrances.com) under **Domains** and add the DNS records it shows you, until the domain says Verified.
2. Under **API Keys**, create a key.
3. In Vercel, **Settings > Environment Variables**, add:
   - `RESEND_API_KEY`: the key
   - `MAIL_FROM`: the sender, on the verified domain, e.g. `Shafar Fragrances <orders@shafarfragrances.com>`
   - `SITE_URL`: the live address, e.g. `https://www.shafarfragrances.com` (links and pictures in emails use it)
   - optional `SESSION_SECRET`: any long random text; changing it signs every customer out
4. Redeploy. Then in the dashboard, **Settings > Email new orders to**, type the addresses that should get an email for every order.

Until `RESEND_API_KEY` is set, ordering still works but no emails go out, and creating an account says sign-ups open soon (an account cannot be confirmed without email).

**3. Open the dashboard**
Go to `yourdomain.com/admin`, sign in with the password, and press **Set up the store**. That creates the tables and copies the 29 fragrances into the database. From then on the shop reads its products from the dashboard.

Until step 2 is done the website still works: it shows the starting product list, and the checkout says ordering is not switched on yet.

## The dashboard

- **Overview**: sales this month against last month, orders, average order, visitors, the share of visitors who ordered, monthly sales and visitor charts, best sellers, sales by category, stock alerts and the latest orders.
- **Orders**: every order with its status (pending, processing, shipped, completed, cancelled), search, a filter per status, CSV export, and a WhatsApp button to message the customer. Cancelling puts the bottles back into stock.
- **Products**: add, edit, hide or delete fragrances; change prices, stock, categories, notes and best-seller flags; upload a new bottle picture. A photo on a plain white background has its background taken away for you, and the card colours are picked from the glass. Changes reach the website within about 10 seconds.
- **Customers**: everyone who has ordered, matched by phone number, with frequent buyers (two or more orders) and Loyal buyers marked and filterable.
- **Members**: customer accounts, who is Shafar Loyal, who is one delivered order away, and who has not confirmed their email yet.
- **Discount codes**: percent or rupees off, minimum order, a use limit and an end date. Customers type them at checkout. A code can be for **Shafar Loyal members only** (once per member), with an occasion name such as "Eid Mubarak"; the **Email to Loyal members** button sends it to every Loyal member.
- **Settings**: delivery charge, free delivery above an amount, a note on the checkout page, a switch to pause ordering, the addresses that get new-order emails, and the Shafar Loyal rules.

Halila Lane, Belford, Charleston and Shawano are drawn by hand on the Featured page, so they can be hidden from the shop but not deleted. Their prices on the Featured page follow the dashboard.

Visitor counts start from the day the database is connected. Each browser gets a random id; no names or addresses are stored.

## Customer accounts and Shafar Loyal

- The person icon in the header (next to the wishlist and cart) opens `/account`. Signed in, it shows the customer's initial.
- **Creating an account**: name, email, password. We email a link; pressing it confirms the email, opens the account, signs the customer in and sends the "Welcome to Shafar, Ali" email. Until the link is pressed the account cannot sign in. Earlier guest orders placed with the same email join the account.
- **The dashboard**: Shafar Loyal status and codes, order history with progress (placed, confirmed, shipped, delivered), the wishlist (kept on the account, so it follows the customer between devices), delivery details used to fill in the checkout, password change, sign out. Forgotten passwords are reset by email.
- **Shafar Loyal**: a customer with 3 **completed** orders becomes Loyal (only Completed counts, so unpaid or returned cash-on-delivery parcels do not). Marking the third order Completed sends the "You are now Shafar Loyal" email. Signed-in Loyal members get 10% off when the order has 2 bottles and 20% off with 4 or more, applied automatically. A discount code and the Loyal reward do not add up; the bigger saving is used. All of these numbers can be changed in Settings.

## Emails

All drawn to match the website (`lib/emails.js`), with the bottle pictures from `assets/mail/` (PNG copies, because some email apps do not show WebP):

| Email | Sent to | When |
|---|---|---|
| Order received | the customer (when they gave an email, or are signed in) | an order is placed |
| New order | the addresses in Settings | an order is placed |
| Confirm your email | the customer | they create an account |
| Welcome to Shafar, Ali | the customer | they press the confirmation link |
| Reset your password | the customer | they ask for it |
| You are now Shafar Loyal | the customer | their 3rd completed order |
| Occasion gift (e.g. "Eid Mubarak, Ali") | every Loyal member | you press Email to Loyal members |

## The catalogue: 29 fragrances

Every fragrance is sold in 50 ml; prices come from the Shafar price list. Categories: 16 Men, 8 Women and 5 Unisex (Halila Lane, Tobacco Oudh, Torrance, White Oudh and Cuba were picked as Unisex for now). Ten are marked as best sellers and fill the Best sellers carousel on Home.

- **23 with a price**, including the four best sellers (Halila Lane, Belford, Charleston, Shawano). Shawano is not on the price list; it keeps the Rs 2,200 given earlier.
- **6 with a picture but no price yet**: Monastir, Imperial, Auckland, Hachita, Elba, Stromboli. They show "Price to be added", their Add to cart button is off, and the product page offers "Ask the price on WhatsApp".
- Onaway and Taskent are on the price list but have no bottle picture yet, so they are not on the site.

Change any of this in the dashboard under Products. (`js/catalog.js` and the lists inside the pages are only the fallback used before the database is connected.)

## What works

- Every link between pages, the menu, and the category links into the Shop.
- Cart and wishlist. They are saved in the visitor's browser, so they carry from page to page and survive a refresh.
- Checkout: cash-on-delivery orders are saved with an order number (SF-10001 and up). Prices, stock, delivery and discount codes are checked on the server.
- Shop filters, sorting and quick view; quantity on the product page.
- The Contact form opens WhatsApp with the message written.

## What is not connected yet

- **SMS.** Customers get emails, not text messages.
- **Emails when an order ships.** Only the order itself is emailed; status changes show in the customer's account.
- **Search engines.** Each page carries `<meta name="robots" content="noindex">` because the build still holds placeholder content. Remove that line at launch.

## Content still to replace

Anything marked on the page with a dashed "Sample" or "Draft" tag is a stand-in:

- Fragrance notes on the product page (every fragrance).
- Reviews on Home and the product page.
- About page: the opening story line, the five making steps, two of the numbers, and the wording of the note from the house.
- Contact page: the delivery-time and returns answers.

Not tagged on the page, but also not final:

- The one-line descriptions under each fragrance name were written for the design and say nothing about the actual scent.

## Where things live

- `api/`: the backend functions (catalogue, orders, accounts, visitor count, dashboard). `lib/`: their shared code (`customer.js` accounts and loyalty, `mail.js` sending, `emails.js` the email designs) and the starting product list.
- `js/account.js`: on every page, the header account button and keeping a signed-in wishlist in step.
- `admin.html`: the dashboard, served at `/admin`.
- `js/catalog.js`: the starting product list, used only when the database is not reachable.
- `assets/`: bottle images (the newer photographed bottles were cut out of their white backgrounds), logo files, the About film (`about-hero.mp4`) and the Instagram tiles.
- Fonts (Google Fonts) and GSAP (cdnjs) load from their CDNs.
