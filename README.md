This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

this discusses how to setup and host this project on AWS 

1. create an Elastic IP on AWS console
2. buy a domain name at https://my.ionos.com/
3. wait until it officially launches then you recieve an email to confirm your ownership
4. modify DNS settings for that domain to point to the Elastic IP address created
5. create a security group that allows HTTP and HTTPS inbound AND outbound traffic from anyone on the internet 
6. create an IAM role with Administrator access
7. create an EC2 instance with the IAM role, security group, and an instance type with atleast 4GB of virtual RAM 
8. BEFORE ACTUALLY CREATING, in additional options paste the following user data to 

8.1 Pull the repository from my github repo and copies it onto the EC2
8.2 Install node and Caddy on the EC2 instance
8.3 Updates all depedencies and anything needed in node modules
8.4 Setup an ENV file (with all the API keys for NEXT_AUTH and the database access)
8.5 Validate the database is reachable
8.6 Setup systemd so we can run the app
8.7 Sets up Caddy so network requests via HTTP or HTTPS to www.DOMAIN_NAME.com are forwarded to the localhost:3000 endpoint internally
8.8 build the service


9. NOW create the instance, but it will have a random IP address it attaches, so go back to the Elastic IP pages and associate the IP with this instance ID
10. update ENV variables if needed and run with the following commands
10.1 sudo systemctl start miraaj
10.2 sudo journalctl -u miraaj -f




#!/usr/bin/env bash
# Logs everything to /var/log/miraaj-setup.log so you can debug after the fact.
exec > >(tee -a /var/log/miraaj-setup.log) 2>&1
echo "===== user-data started at $(date -u) ====="

set -eux
export DEBIAN_FRONTEND=noninteractive

# --- 1. Wait for outbound network. Cloud-init sometimes fires before the
#        IPv4 default route is installed; apt then dies with "Network is
#        unreachable". Block until we can actually reach the internet.
echo "--- waiting for outbound network"
for i in $(seq 1 60); do
  if curl -fsS --max-time 3 https://deb.nodesource.com >/dev/null 2>&1; then
    echo "    network up after ${i}s"
    break
  fi
  sleep 2
done

# --- 2. Wait out the unattended-upgrades apt lock that Ubuntu cloud images
#        often hold during first boot.
echo "--- waiting for apt lock"
while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
   || fuser /var/lib/apt/lists/lock      >/dev/null 2>&1; do
  echo "    apt is busy, sleeping 5s"
  sleep 5
done

# --- 3. Base packages. NOTE: do NOT include debian-keyring or
#        debian-archive-keyring — those packages don't exist on noble (24.04)
#        and will hard-fail the script.
echo "--- base packages"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg apt-transport-https

# --- 4. Node 20 from NodeSource.
echo "--- node 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# --- 5. Caddy from the official Cloudsmith repo.
echo "--- caddy"
curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# --- 6. Clone the repo (public, no auth needed).
echo "--- cloning repo"
sudo -u ubuntu git clone https://github.com/sammalik111/MiraajGames.git /home/ubuntu/app

# --- 7. Placeholder env file. You'll edit it after first SSH.
#        Includes AUTH_TRUST_HOST=true (required behind Caddy reverse proxy)
#        and NEXTAUTH_URL set to the public domain.
echo "--- placeholder /etc/miraaj.env"
cat >/etc/miraaj.env <<'EOF'
DATABASE_URL=REPLACE_ME
NEXTAUTH_SECRET=REPLACE_ME
NEXTAUTH_URL=https://miraajgames.com
AUTH_TRUST_HOST=true
EOF
chmod 600 /etc/miraaj.env

# --- 8. systemd unit. Binds Next.js to 127.0.0.1 only — defense in depth so
#        :3000 isn't reachable from the internet even if the SG slips.
echo "--- systemd unit"
cat >/etc/systemd/system/miraaj.service <<'EOF'
[Unit]
Description=Miraaj Games Next.js
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/app
ExecStart=/usr/bin/npx next start -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/etc/miraaj.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=miraaj

[Install]
WantedBy=multi-user.target
EOF

# --- 9. Caddyfile — reverse proxy + automatic HTTPS via Let's Encrypt.
#        OVERWRITES the default :80 welcome page Caddyfile.
echo "--- caddyfile"
cat >/etc/caddy/Caddyfile <<'EOF'
miraajgames.com, www.miraajgames.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
EOF

# --- 10. Enable services. Caddy starts now (it just serves a TLS handshake
#         error until DNS + the app are live, which is fine). miraaj is
#         enabled but not started — placeholder env would crash it.
echo "--- enable services"
systemctl daemon-reload
systemctl enable --now caddy
systemctl reload caddy
systemctl enable miraaj.service

echo "===== user-data finished at $(date -u) ====="
echo
echo "NEXT STEPS (do these via SSH):"
echo "  1. sudo nano /etc/miraaj.env       # paste real DATABASE_URL + NEXTAUTH_SECRET"
echo "  2. cd /home/ubuntu/app"
echo "     set -a; source /etc/miraaj.env; set +a"
echo "     npm ci && npm run build"
echo "  3. sudo systemctl start miraaj"
echo "  4. visit https://miraajgames.com"






# system design

https://excalidraw.com/#json=as_teY49gs9QyCeSTlr62,_MAdtJdxsLqGq9inkMqdgA



