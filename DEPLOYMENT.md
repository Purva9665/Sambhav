# Deploying the SAMBHAV Portal on Render

Two services: a **Web Service** for the API and a **Static Site** for the UI.
Deploy the backend first — you need its URL to configure the frontend.

---

## Before you start

Have these ready:

| Thing | Where to get it |
|:--|:--|
| MongoDB Atlas connection string | Atlas → Database → Connect → Drivers |
| A JWT secret (64 hex chars) | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| SendGrid API key | SendGrid → Settings → API Keys → Create (needs **Mail Send**) |
| A **verified** sender address | SendGrid → Settings → Sender Authentication (see step 4) |

In **Atlas → Network Access**, add `0.0.0.0/0`. Render's outbound IPs are dynamic
on the free tier, so an IP allowlist will intermittently fail to connect.

---

## 1. Push the code

```bash
git add -A && git commit -m "Rebuild portal UI and harden for deployment"
```

```bash
git push origin main
```

---

## 2. Backend — Web Service

**New → Web Service**, point it at the repo, then:

| Setting | Value |
|:--|:--|
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/v1/health` |

### Environment variables

Set these under **Environment**. The server **refuses to start** without the
first two — that is deliberate, so a misconfigured deploy fails loudly instead
of silently signing forgeable tokens.

| Key | Value | Notes |
|:--|:--|:--|
| `MONGODB_URI` | your Atlas string | Include the database name |
| `JWT_SECRET` | the 64-char hex string | Must be ≥ 32 chars |
| `NODE_ENV` | `production` | |
| `ADMIN_EMAIL` | your email | Where registration codes are sent |
| `CORS_ORIGINS` | *(fill in after step 3)* | No trailing slash |
| `SENDGRID_API_KEY` | `SG.…` | |
| `SENDGRID_FROM_EMAIL` | your **verified** sender | See step 4 |
| `SENDGRID_FROM_NAME` | `SAMBHAV Portal` | |
| `PORTAL_TIMEZONE` | `Asia/Kolkata` | Decides what "today" means |
| `JWT_EXPIRES_IN` | `8h` | Session length (optional) |
| `ADMIN_INITIAL_PASSWORD` | a strong password, ≥ 12 chars | **Delete after first sign-in** |

Deploy, then open the logs. A healthy start looks like:

```
[EMAIL] SendGrid active. Sending as "SAMBHAV Portal" <you@example.com>.
[TIME] Calendar dates resolved in Asia/Kolkata.
[DATABASE] Connected.
[BOOTSTRAP] Created the first administrator: you@example.com
[SERVER] Listening on port 10000 (production).
```

Confirm with `https://YOUR-API.onrender.com/api/v1/health` — you want
`{"status":"ok","database":"connected", …}`.

---

## 3. Frontend — Static Site

**New → Static Site**, same repo:

| Setting | Value |
|:--|:--|
| Root Directory | `client` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

### Environment variable

| Key | Value |
|:--|:--|
| `VITE_API_URL` | `https://YOUR-API.onrender.com` |

No trailing slash and no `/api/v1` — the client appends that itself.

> Vite inlines `VITE_*` at **build** time. Changing it later requires a new
> build, not just a restart. Use **Manual Deploy → Clear build cache & deploy**.

`client/public/_redirects` is already in the repo, so all routes serve
`index.html` and deep links do not 404.

### Then close the CORS loop

Go back to the backend service and set:

```
CORS_ORIGINS=https://YOUR-SITE.onrender.com
```

Add `,http://localhost:3000` too if you develop locally. Save — the API
restarts automatically. Until you do this, the browser blocks every request.

---

## 4. Email: delivery and staying out of spam

### Sender verification — already done

`purvakadam9637@gmail.com` is verified as a Single Sender in your SendGrid
account. A live test confirmed SendGrid **accepts** these sends with no 403, so
this is not what is breaking mail.

If you ever change `SENDGRID_FROM_EMAIL`, the new address must be verified the
same way: SendGrid → Settings → **Sender Authentication** → **Single Sender
Verification** → click the link in the confirmation email. Until the badge reads
**Verified**, every send returns **403 Forbidden**.

### Why the emails land in spam

Because the `From:` address is a **gmail.com** address being sent by SendGrid's
servers. Mailbox providers check whether the sending server is authorised by the
`From:` domain:

- **SPF** asks "is SendGrid allowed to send for gmail.com?" — gmail.com's SPF
  record does not list SendGrid, so this fails.
- **DKIM** signs as `sendgrid.net`, not `gmail.com`, so the signature does not
  *align* with the `From:` domain.
- **DMARC** then sees an unaligned message claiming to be from gmail.com.

To Gmail this looks like someone spoofing a Gmail user, which is exactly the
pattern phishing uses. Since February 2024 Google's bulk-sender rules make this
worse — SPF, DKIM and DMARC alignment are effectively required. A verified
Single Sender gets SendGrid to *accept* the mail; it does nothing for how the
*receiver* judges it.

### The fix: authenticate a domain you own

You cannot fix this while sending from `@gmail.com` — nobody can authorise
SendGrid for a domain Google controls. You need a domain of your own (a `.org`
or `.in` for the club is a few hundred rupees a year):

1. SendGrid → Settings → **Sender Authentication** → **Authenticate Your Domain**.
2. Enter your domain (e.g. `sambhav.org`) and your DNS host.
3. SendGrid gives you **three CNAME records**. Add them at your registrar.
4. Click **Verify**. SendGrid then signs mail as your domain, and SPF/DKIM align.
5. Publish a DMARC record — start permissive, tighten later:
   `_dmarc.sambhav.org  TXT  "v=DMARC1; p=none; rua=mailto:you@sambhav.org"`
6. Set `SENDGRID_FROM_EMAIL=noreply@sambhav.org` and redeploy.

That single change is what moves these out of spam. Everything below is a
smaller improvement on top of it.

### Until you have a domain

These reduce, but do not eliminate, spam placement:

- **Mark one as "Not spam"** in Gmail and add the sender to your contacts. Since
  the codes go to *your own* admin inbox, this alone often fixes it for you.
- **Create a Gmail filter**: matching `from:purvakadam9637@gmail.com subject:SAMBHAV`,
  tick *Never send it to Spam*. This is the practical workaround for the OTP
  emails, because they only ever go to the admin.
- Keep sending volume low and steady — sudden bursts look like spam.

### If email stops working entirely

| Log line | Meaning | Fix |
|:--|:--|:--|
| `[EMAIL:SENT]` | SendGrid accepted it | Delivery problem, not sending — see above |
| `[EMAIL:FAILED] status=403` | Sender not verified | Verify `SENDGRID_FROM_EMAIL` |
| `[EMAIL:FAILED] status=401` | Bad API key | Reissue `SENDGRID_API_KEY` |
| `SendGrid is NOT configured` | A variable is missing | The log names which one |

Every attempt is also recorded in the `emaillogs` collection with its status and
error, so you can audit delivery after the fact.

## 5. First sign-in

1. Open your static site URL.
2. Sign in with `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`.
3. **Delete `ADMIN_INITIAL_PASSWORD`** from the backend environment and redeploy.

The bootstrap only ever runs when the database contains no admin at all, and it
never modifies existing users — so removing the variable is safe, and leaving it
set is the only real risk.

### Two entrances

| URL | Who |
|:--|:--|
| `/` | Everyone |
| `/admin` | Administrators |

`/admin` is a **separate screen, not separate security**. It posts to the same
endpoint and the same server-side RBAC applies; a non-admin who signs in there
is simply told to use the main page. Privilege comes from the database, never
from which form was used — so there is nothing to bypass.

`client/public/_redirects` makes `/admin` resolve on Render's static host.

### Adding more admins

Two ways, both from **Team Directory**:

1. **Create account** — make the account outright at any role, including Admin.
   No registration, no OTP; it is active immediately and you are shown a
   temporary password once, to hand over. Use this for someone like a former
   president.
2. **Add admin** — promote an existing member.

Note:

- You cannot remove your own admin role (it would lock you out).
- The last active admin cannot be demoted.
- Every change is written to the audit log.

---

## Free-tier behaviour

Render spins down idle free services. The first request after a spin-down takes
**30–60 seconds** while the container restarts, so the first sign-in of the day
may look like a hang. The paid tier removes this.

---

## Troubleshooting

| Symptom | Cause | Fix |
|:--|:--|:--|
| Service won't start, `[FATAL] Missing required environment variable(s)` | Variable not set | Set it and redeploy — this is the guard working |
| `[FATAL] JWT_SECRET must be at least 32 characters` | Secret too short | Generate a proper one |
| `[FATAL] Could not connect to MongoDB` | Atlas blocking Render | Add `0.0.0.0/0` in Network Access |
| Every request fails in the browser console with CORS | `CORS_ORIGINS` unset or mismatched | Set it to the exact site origin, no trailing slash |
| UI loads but all data is empty | `VITE_API_URL` wrong or stale | Fix it, then **clear build cache & deploy** |
| Sign-in says "session expired" immediately | `JWT_SECRET` changed between deploys | Expected — everyone must sign in again |
| OTP email never arrives | Unverified sender | See step 4; check the logs for the status code |
