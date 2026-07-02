# Fires FitArena notifications (daily reminder + win/join/overtake nudges).
# Runs every ~20 min. Costs a few free Action minutes a month.
#
# ONE-TIME SETUP — add these repo secrets (Settings → Secrets and variables → Actions):
#   NOTIFY_URL     = https://YOUR-APP.vercel.app/api/notify
#   NOTIFY_SECRET  = the same random string you set in Vercel env
name: fitarena-notify
on:
  schedule:
    - cron: "*/20 * * * *"
  workflow_dispatch: {}
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sender
        run: |
          code=$(curl -s -o /dev/null -w "%{http_code}" "$NOTIFY_URL?secret=$NOTIFY_SECRET")
          echo "notify responded: $code"
        env:
          NOTIFY_URL: ${{ secrets.NOTIFY_URL }}
          NOTIFY_SECRET: ${{ secrets.NOTIFY_SECRET }}
