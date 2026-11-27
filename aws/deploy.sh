#!/bin/bash
# Deploys (or updates) The Little LUXE's AWS backend and fills in products.js.
# Usage:  bash aws/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PROFILE="${AWS_PROFILE:-funny-shorts}"     # this Mac's profile for the personal AWS account
EXPECTED_ACCOUNT="327712415896"            # never deploy anywhere else
REGION="${REGION:-ap-south-1}"             # Mumbai — closest to customers in India
STACK="tll-shop"
export AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" AWS_PAGER=""

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "Stopped: profile '$PROFILE' is account $ACCOUNT, not the shop's account $EXPECTED_ACCOUNT." >&2
  exit 1
fi
echo "Deploying to account $ACCOUNT ($REGION)…"

# Switch on every sign-in provider that exists in the user pool (e.g. Google, added in the Cognito console)
POOL=$(aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text 2>/dev/null || true)
SOCIAL=""
if [ -n "$POOL" ] && [ "$POOL" != "None" ]; then
  SOCIAL=$(aws cognito-idp list-identity-providers --user-pool-id "$POOL" --query 'Providers[].ProviderName' --output text | tr '\t' ',')
fi
PROVIDERS="COGNITO${SOCIAL:+,$SOCIAL}"
echo "Sign-in options: $PROVIDERS"

aws cloudformation deploy \
  --stack-name "$STACK" \
  --template-file aws/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "IdentityProviders=$PROVIDERS" \
  --no-fail-on-empty-changeset

echo "Uploading the API code…"
TMP=$(mktemp -d)
cp aws/api/index.mjs "$TMP/"
(cd "$TMP" && zip -q api.zip index.mjs)
aws lambda update-function-code --function-name tll-api --zip-file "fileb://$TMP/api.zip" --query 'LastUpdateStatus' --output text >/dev/null
aws lambda wait function-updated-v2 --function-name tll-api
rm -rf "$TMP"

echo "Writing the settings into products.js…"
aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].Outputs' --output json > aws/outputs.json
SOCIAL="$SOCIAL" node -e '
  const fs = require("fs");
  const out = Object.fromEntries(JSON.parse(fs.readFileSync("aws/outputs.json")).map(o => [o.OutputKey, o.OutputValue]));
  let s = fs.readFileSync("products.js", "utf8");
  const set = (k, v) => { s = s.replace(new RegExp(`(\\n\\s*${k}: )"[^"]*"`), `$1"${v}"`); };
  set("authDomain", out.AuthDomain);
  set("clientId", out.ClientId);
  set("apiUrl", out.ApiUrl.replace(/\/$/, ""));
  set("cdnUrl", out.CdnUrl);
  const social = (process.env.SOCIAL || "").split(",").filter(Boolean);
  s = s.replace(/(\n\s*providers: )\[[^\]]*\]/, `$1${JSON.stringify(social)}`);
  fs.writeFileSync("products.js", s);
  console.log(JSON.stringify(out, null, 2));
'
echo
echo "Done. Next: sign up on the website with the owner's email, then run:"
echo "  bash aws/make-owner.sh you@example.com"
