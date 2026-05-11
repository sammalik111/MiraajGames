# Installing AWS CLI on the EC2 instance

Useful for poking around (`aws ec2 describe-instances`, `aws cloudwatch list-metrics`, etc.) — not required for the app itself, which uses the JS SDK.

## Install

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt install unzip
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

## Verify the attached IAM role
Below command should return the role attached to the instance.

```bash
aws ec2 describe-instances --instance-ids <YOUR_INSTANCE_ID> --query 'Reservations[*].Instances[*].IamInstanceProfile'
```



## Verify credential resolution
Below Command shows where each credential value is coming from. 
1. On a production EC2 box this should read `iam-role` for both `access_key` and `secret_key`. If it reads `env` or `shared-credentials-file`, the SDK will use those instead of IMDS.

```bash
aws configure list
```


