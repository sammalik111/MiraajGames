# Deployment (AWS EC2 + Caddy)

End-to-end provisioning of a production box: Elastic IP, domain DNS, EC2 with user-data, systemd, Caddy reverse proxy with automatic HTTPS.

## Outline

1. **AWS console — Elastic IP**: allocate a new Elastic IP (you'll associate it to the instance later).
2. **Buy a domain** (IONOS, Namecheap, whatever) and wait for ownership confirmation.
3. **Domain DNS**: point an A record (`@`) and a `www` A record at the Elastic IP.
4. **Security Group**: allow inbound + outbound HTTP (80) and HTTPS (443) from anywhere. SSH (22) only from your IP.
5. **IAM Role**: create one with the permissions the app needs (CloudWatch read only access) and attach it to the instance.
6. **EC2 Instance**: launch with the IAM role + security group + ≥ 4 GB RAM instance type. **Paste the user-data script below into Additional Details → User data** before clicking Launch.
7. **Associate Elastic IP** to the instance (Elastic IPs → Actions → Associate).
8. SSH in, fill `/etc/miraaj.env`, run the build, start the service.

## User-data script

Paste this into the **User data** field at launch time. It bootstraps Node, Caddy, clones the repo, writes a placeholder env file, sets up systemd, and configures Caddy with automatic HTTPS.

    ```bash
    #!/usr/bin/env bash
    # Log everything so you can debug after the fact.
    exec > >(tee -a /var/log/miraaj-setup.log) 2>&1
    echo "===== user-data started at $(date -u) ====="

    set -eux
    export DEBIAN_FRONTEND=noninteractive

    # --- 1. Wait for outbound network. Cloud-init can fire before the IPv4
    #        default route exists; apt then dies with "Network is unreachable".
    echo "--- waiting for outbound network"
    for i in $(seq 1 60); do
      if curl -fsS --max-time 3 https://deb.nodesource.com >/dev/null 2>&1; then
        echo "    network up after ${i}s"
        break
      fi
      sleep 2
    done

    # --- 2. Wait out the unattended-upgrades apt lock.
    echo "--- waiting for apt lock"
    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
      || fuser /var/lib/apt/lists/lock      >/dev/null 2>&1; do
      echo "    apt is busy, sleeping 5s"
      sleep 5
    done

    # --- 3. Base packages. Do NOT include debian-keyring on noble (24.04) —
    #        it doesn't exist there and will fail the script.
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
    sudo -u ubuntu git clone <YOUR_REPO_URL> /home/ubuntu/app

    # --- 7. Placeholder env file. Edit after first SSH.
    #        AUTH_TRUST_HOST=true is required behind any reverse proxy.
    echo "--- placeholder /etc/miraaj.env"
    cat >/etc/miraaj.env <<'EOF'
    DATABASE_URL=REPLACE_ME
    NEXTAUTH_SECRET=REPLACE_ME
    NEXTAUTH_URL=https://YOUR_DOMAIN.com
    AUTH_TRUST_HOST=true
    ADMIN_IDS=<your-user-id>
    AWS_REGION=us-east-1
    EC2_INSTANCE_ID=<this-instances-id>
    EOF
    chmod 600 /etc/miraaj.env

    # --- 8. systemd unit. Binds Next.js to 127.0.0.1 only — defense in depth
    #        so :3000 isn't reachable from the internet even if the SG slips.
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
    echo "--- caddyfile"
    cat >/etc/caddy/Caddyfile <<'EOF'
    YOUR_DOMAIN.com, www.YOUR_DOMAIN.com {
        encode zstd gzip
        reverse_proxy 127.0.0.1:3000
    }
    EOF

    # --- 10. Enable services. Caddy starts now (TLS handshake errors until
    #         DNS resolves; harmless). miraaj is enabled but not started —
    #         placeholder env would crash it.
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
    echo "  4. visit https://YOUR_DOMAIN.com"
    ```

## After the user-data finishes

SSH in and run:

```bash
sudo nano /etc/miraaj.env                 # create env file and add ENV VARS
cd /home/ubuntu/app                       # navigate into the app
set -a; source /etc/miraaj.env; set +a    # set all env variables 
npm ci                                    # install dependencies
npm run build                             # build package
sudo systemctl start miraaj               # start service
sudo systemctl status miraaj              # confirm "active (running)"
```

Visit `https://YOUR_DOMAIN.com`
