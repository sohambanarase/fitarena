# Keeps the Supabase free-tier project awake by pinging the database once a day,
# so it never hits the 7-day inactivity pause. Costs nothing (a few seconds/day).
#
# ONE-TIME SETUP (in your GitHub repo):
#   Settings → Secrets and variables → Actions → New repository secret, add:
#     SUPABASE_URL       = your https://xxxx.supabase.co
#     SUPABASE_ANON_KEY  = your publishable/anon key
name: supabase-keepalive
on:
  schedule:
    - cron: "0 7 * * *"   # every day at 07:00 UTC
  workflow_dispatch: {}     # lets you run it manually from the Actions tab
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping database
        run: |
          curl -sS -o /dev/null -w "status: %{http_code}\n" \
            "$SUPABASE_URL/rest/v1/profiles?select=id&limit=1" \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY"
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
