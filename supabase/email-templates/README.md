# Email templates

Supabase renders auth emails from templates stored in the project dashboard, not
from this repo — these files are the source of truth we edit, then paste in.

## Magic link (`magic-link.html`)

Styled to match the app: parchment background, white card, pine (`#0e2018`)
button with chartreuse (`#d9f45c`) label, 56px tall and full width so it is an
easy thumb target on a phone.

To install:

1. Supabase dashboard → your project → **Authentication** → **Emails** →
   **Magic Link** (the template tabs, not the SMTP provider section below them).
2. Subject: `Your Good Content sign-in link`
3. Paste the entire contents of `magic-link.html` into the message body, save.
4. Send yourself a link from `/login` and check it on a phone.

Template variables used: `{{ .ConfirmationURL }}` (the sign-in link Supabase
generates — it already carries the `emailRedirectTo` target set in
`src/app/(auth)/login/actions.ts`) and `{{ .Email }}`.

Notes:

- Outlook gets a VML `<v:roundrect>` version of the button; every other client
  gets the `<a>` block. Both point at the same URL.
- Styles are inline because Gmail strips `<style>` blocks in many contexts.
- The link is still one-time-use and expires per the project's OTP expiry
  setting; the copy in the template says "about an hour" — change the copy if
  you change that setting.
