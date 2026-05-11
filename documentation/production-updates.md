# Production Updates
How to ship a new version to the EC2 instance, and how to automate it on a nightly cron.

## Manual update

SSH into the instance and run:

```bash
cd ~/app
git pull origin main
npm run build
sudo systemctl restart miraaj
sudo systemctl status miraaj
```

If `npm run build` fails (TypeScript error, missing dep), the running service is unaffected — systemd keeps the old build alive until you successfully restart.





## Automated nightly update

Pulls + rebuilds + restarts every night at 3 AM. Useful if you push to `main` frequently and want the server to stay current without SSHing in.

### 1. Create the update script

```bash
nano ~/updateInstanceRequest.py
```

```python
        #!/usr/bin/env python3

        import subprocess
        import os

        APP_DIR = os.path.expanduser("~/app")

        commands = [
            "git pull origin main",
            "npm run build",
            "sudo systemctl restart miraaj",
        ]

        try:
            os.chdir(APP_DIR)

            for command in commands:
                print(f"Running: {command}")
                result = subprocess.run(
                    command,
                    shell=True,
                    check=True,
                    text=True,
                    capture_output=True,
                )
                print(result.stdout)

            print("Update completed successfully.")

        except subprocess.CalledProcessError as e:
            print(f"Command failed: {e.cmd}")
            print(e.stderr)
            raise
```

### 2. Schedule the script to run at 3am every night

```bash
crontab -e                              # 1. open cron tab file
0 3 * * * /usr/bin/python3 /home/ubuntu/updateInstanceRequest.py >> /home/ubuntu/updateInstanceRequest.log 2>&1 # add line to the file and save
crontab -l                              # 3. verify its installed
tail -f ~/updateInstanceRequest.log     # 4. Tail the cron log
```
