#!/bin/bash
# Gives an existing customer account owner access (the "admins" group) so it can use admin.html.
# Usage:  bash aws/make-owner.sh owner@example.com
set -euo pipefail
cd "$(dirname "$0")/.."
EMAIL="${1:?Usage: bash aws/make-owner.sh owner@example.com}"
export AWS_PROFILE="${AWS_PROFILE:-funny-shorts}" AWS_REGION="${REGION:-ap-south-1}" AWS_PAGER=""

[ "$(aws sts get-caller-identity --query Account --output text)" = "327712415896" ] || { echo "Stopped: wrong AWS account." >&2; exit 1; }
POOL=$(aws cloudformation describe-stacks --stack-name tll-shop --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER=$(aws cognito-idp list-users --user-pool-id "$POOL" --filter "email = \"$EMAIL\"" --query 'Users[0].Username' --output text)
if [ "$USER" = "None" ] || [ -z "$USER" ]; then
  echo "No account with $EMAIL yet — sign up on the website first, then run this again." >&2
  exit 1
fi
aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL" --username "$USER" --group-name admins
echo "$EMAIL is now an owner. Sign out and back in on the website to see 'Manage the shop'."
