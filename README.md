# Amanat

A list of originals that are not in the house. A degree at the college office, a sale deed with the broker, a laptop at the repair shop, a key with the painter. You write who has it and what they said. You do not keep a photo of the document.

Nothing is uploaded. There is no account and no server to pay for. After one online visit, add it to the home screen and it opens offline.

## Free, and the one-time unlock

Free on every phone:

- Three originals out at the same time
- How long each one has been out
- A returned pile, so you can see what already came home

Once, if you turn payment on:

- A longer list
- A photo of the receipt or the counter, never required, and not a scan of the paper
- A one-page return note you can print and hand over

People pay you, not a subscription you have to keep alive. You sign a code on your own computer with `license-desk.html` and the private key that was created with this project. Only the public half is in the app. A Baant key will not work here.

Edit [`js/config.js`](js/config.js) and set `upiId`, `payeeName`, and the price. Until `upiId` is empty, the app does not show a pay button.

The source is public, so a person who edits the JavaScript can ignore the lock. Ordinary users will not. That is the tradeoff of shipping with no server.

## Put it on the internet for nothing

GitHub Pages is free for a public repository.

1. On this repository, open **Settings → Pages**.
2. Deploy from the `main` branch, folder `/` (root).
3. Open the site it gives you. Share that link.
4. On a phone: browser menu → **Add to Home Screen**.

## Give someone a code

1. Open `license-desk.html` on your own machine. Do not paste the private key into anyone else’s website.
2. Paste your Amanat private key. Type the person’s name. Make a code.
3. They paste it under Settings.

Keep the private key in a password manager. It is not in this repository. If you lose it, generate a new pair, put the new public key in `js/license.js`, and ship that update. Old codes will stop matching.

## Backups

Settings downloads one JSON file. Restoring it is how someone changes phones. There is no cloud copy.

## Privacy

Amanat does not make network calls of its own. A UPI link, if you configured one, opens the payer’s own app. Details in [PRIVACY.md](PRIVACY.md).
