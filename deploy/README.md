# Deploying the Antnet loader

The loader is a small set of static files: the shell page, its scripts, the service worker and the SDK's WASM. nginx
serves the same files at `antnet.autonomirror.com` and at every `*.antnet.autonomirror.com` site subdomain. Site
content never passes through the server.

The VPS already runs nginx for impactivefinance.com. Antnet is added as one more nginx site with its own server
names, so the existing site is untouched. autonomirror.com itself stays on GitHub Pages; only the `antnet` part of
its DNS changes.

The one-time setup is steps 1–5. After that, every update is step 6.

## 1. Check whether GoDaddy's API works for you

Every site has its own subdomain, so the server needs a **wildcard** certificate. Let's Encrypt only issues one if the
server can create a temporary DNS record through the DNS provider's API. GoDaddy restricts API access to some
accounts, so check it first.

1. Create a **Production** key at <https://developer.godaddy.com/keys>.
2. Test it. Replace `KEY` with the key and `SECRET` with the secret, keeping the colon between them and with no
   spaces. Type the command on one line. The `bash` and `powershell` labels on these boxes aren't part of the
   commands.

   On the VPS:

   ```bash
   curl -s -H "Authorization: sso-key KEY:SECRET" https://api.godaddy.com/v1/domains/autonomirror.com
   ```

   In Windows PowerShell, type `curl.exe`, because plain `curl` there is a different command:

   ```powershell
   curl.exe -s -H "Authorization: sso-key KEY:SECRET" https://api.godaddy.com/v1/domains/autonomirror.com
   ```

What the reply tells you:
- **The domain's details:** the API works. Use **route A** below.
- **`ACCESS_DENIED` or similar:** the API is restricted for this account. Use **route B**. Delete the key you made.

## 2. DNS records

Find the VPS's addresses on the VPS:

```bash
curl -4 -s https://ifconfig.me; echo
ip -6 addr show scope global | grep inet6
```

### Route A: GoDaddy keeps the records

In GoDaddy's DNS for autonomirror.com, add:

| Type | Name | Value |
| --- | --- | --- |
| A | `antnet` | the VPS's IPv4 address |
| A | `*.antnet` | the VPS's IPv4 address |
| AAAA | `antnet` | the VPS's IPv6 address, only if it has one |
| AAAA | `*.antnet` | the VPS's IPv6 address, only if it has one |

### Route B: hand only `antnet` to deSEC

[deSEC](https://desec.io) is a free, non-profit DNS host with an API. This hands over only `antnet.autonomirror.com`
and the names under it. Everything else on autonomirror.com stays at GoDaddy.

1. Sign up at desec.io.
2. Add the domain `antnet.autonomirror.com`, and in it add these records:
   - an `A` record with an empty subname and the VPS's IPv4 address;
   - an `A` record with subname `*` and the same address;
   - the matching `AAAA` records, only if the VPS has IPv6.
3. Create a token under **Token management**. Keep it for step 4.
4. In GoDaddy's DNS for autonomirror.com, add **NS** records with name `antnet` for each nameserver deSEC lists,
   for example `ns1.desec.io` and `ns2.desec.org`.

### Check the records

After a few minutes, from any machine:

```bash
nslookup antnet.autonomirror.com
nslookup test.antnet.autonomirror.com
```

Both should return the VPS's address. Any name under `antnet` should resolve the same way.

## 3. Certificate (on the VPS)

These steps install acme.sh, which issues the wildcard certificate and renews it automatically. Run them as root
(`sudo -i`), and use your own email for expiry notices:

```bash
curl https://get.acme.sh | sh -s email=you@example.com
exec bash   # reload the shell so acme.sh is on the path

# Route A (GoDaddy):
export GD_Key="..." GD_Secret="..."
acme.sh --issue --server letsencrypt --dns dns_gd -d antnet.autonomirror.com -d '*.antnet.autonomirror.com'

# Route B (deSEC):
export DEDYN_TOKEN="..."
acme.sh --issue --server letsencrypt --dns dns_desec -d antnet.autonomirror.com -d '*.antnet.autonomirror.com'
```

Then put the certificate where nginx expects it, and reload nginx on every renewal:

```bash
mkdir -p /etc/ssl/antnet
acme.sh --install-cert --ecc -d antnet.autonomirror.com \
  --key-file /etc/ssl/antnet/key.pem \
  --fullchain-file /etc/ssl/antnet/fullchain.pem \
  --reloadcmd "systemctl reload nginx"
```

acme.sh saves the API credentials in its own config, readable only by root, so renewals run unattended.

## 4. The web root (on the VPS)

Create it, owned by the account you log in with over SSH, so deploys don't need `sudo`:

```bash
sudo mkdir -p /var/www/antnet/releases
sudo chown -R "$USER": /var/www/antnet
```

## 5. The nginx site (on the VPS)

1. Copy the config to the VPS as a **file** named `antnet`, from PowerShell in the project folder:

   ```powershell
   scp deploy\nginx\antnet.conf root@<vps address>:/etc/nginx/sites-available/antnet
   ```

   Check it on the VPS: `ls -l /etc/nginx/sites-available/antnet` should show a line starting with `-rw`, not `d`.
   If it's a folder (`d`), nginx will fail with "Is a directory". Move the file out of the folder, remove the
   folder with `rmdir`, and put the file in its place.
2. Enable it, test the whole configuration, and reload only if the test passes:

   ```bash
   sudo ln -s /etc/nginx/sites-available/antnet /etc/nginx/sites-enabled/antnet
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. Check that nginx knows the WASM type: `grep wasm /etc/nginx/mime.types` should print `application/wasm wasm;`.

If `nginx -t` fails, nothing has changed for impactivefinance.com: the reload only runs after a passing test. Remove
the link with `sudo rm /etc/nginx/sites-enabled/antnet` and send me the error.

## 6. Deploy (from Windows, in the project folder)

```powershell
.\deploy\deploy.ps1 -Server you@your-vps
```

This does three things:
1. Builds the loader with `antnet.autonomirror.com` as its root.
2. Copies it to a new folder under `/var/www/antnet/releases/`.
3. Switches `/var/www/antnet/current` to that folder in one step.

It keeps the last five releases.

Then open <https://antnet.autonomirror.com/>. The landing page should appear, and pasting an address should open the
site at its own subdomain.

## Rolling back

```bash
ls /var/www/antnet/releases
ln -sfn /var/www/antnet/releases/<older> /var/www/antnet/current
```
