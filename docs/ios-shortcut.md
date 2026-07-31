# iOS Shortcut: Save to Good Content

This adds **Good Content** to the iPhone Share Sheet. Setup takes about two
minutes and only needs to be done once.

## Before you start

1. Open Good Content → **Settings**.
2. Create a capture token labeled `iPhone Shortcut`.
3. Copy it immediately. The full token is shown only once.

## Build the Shortcut

1. Open Apple’s **Shortcuts** app and tap **+**.
2. Name the shortcut `Save to Good Content`.
3. Open the shortcut details, enable **Show in Share Sheet**, and set the
   accepted input to **URLs**.
4. Add **Get Contents of URL**.
5. Set the URL to:

   ```text
   https://YOUR-VERCEL-DOMAIN/api/capture
   ```

6. Set the method to **POST**.
7. Under **Headers**, add:

   ```text
   Authorization: Bearer YOUR_CAPTURE_TOKEN
   Content-Type: application/json
   ```

8. Set **Request Body** to **JSON** with:

   ```text
   url: Shortcut Input
   ```

9. Optionally add **Show Notification** with the text `Saved to Good Content`.

## Test it

Open an article in Safari, tap **Share**, and choose **Save to Personal
Library**. The endpoint returns immediately; extraction, summary, and embeddings
continue in the background. The item first appears as *Queued* or *Reading*,
then becomes *Ready*.

If the shortcut returns `401`, create a new token and replace the Authorization
header. If it returns `429`, wait until the one-hour capture window resets.
