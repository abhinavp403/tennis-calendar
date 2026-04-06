#!/usr/bin/env python3
"""
Download tournament logos for the Tennis Calendar app.
Logos are placed in public/logos/
"""

import os
import json
import urllib.request
import urllib.error
import time

LOGO_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'logos')

# Map of logo filename → URL to try downloading from
# Using Wikipedia/Wikimedia Commons and other open sources
LOGO_URLS = {
    # ATP logos
    "atp_hong_kong_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Hong_Kong_Open_tennis.png/200px-Hong_Kong_Open_tennis.png",
    "atp_brisbane_international.png": "https://upload.wikimedia.org/wikipedia/en/thumb/b/ba/Brisbane_International_logo.svg/200px-Brisbane_International_logo.svg.png",
    "atp_adelaide_international.png": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Adelaide_International_tennis_logo.svg/200px-Adelaide_International_tennis_logo.svg.png",
    "atp_auckland_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/ASB_Classic_logo.svg/200px-ASB_Classic_logo.svg.png",
    "atp_open_occitanie.png": "https://upload.wikimedia.org/wikipedia/fr/thumb/e/e6/Logo-open-sud-de-france.png/200px-Logo-open-sud-de-france.png",
    "atp_dallas_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f8/Dallas_Open_logo.svg/200px-Dallas_Open_logo.svg.png",
    "atp_rotterdam_open.png": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/ABN_AMRO_World_Tennis_Tournament_logo.svg/200px-ABN_AMRO_World_Tennis_Tournament_logo.svg.png",
    "atp_argentina_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/0/06/Argentina_Open_tennis_logo.svg/200px-Argentina_Open_tennis_logo.svg.png",
    "atp_qatar_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/17/Qatar_ExxonMobil_Open_logo.svg/200px-Qatar_ExxonMobil_Open_logo.svg.png",
    "atp_rio_open.png": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Rio_Open_logo.svg/200px-Rio_Open_logo.svg.png",
    "atp_delray_beach_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/11/Delray_Beach_Open_logo.svg/200px-Delray_Beach_Open_logo.svg.png",
    "atp_dubai_tennis_championships.png": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Dubai_Tennis_Championships_logo.svg/200px-Dubai_Tennis_Championships_logo.svg.png",
    "atp_mexican_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/7/70/Abierto_Mexicano_Telcel_logo.svg/200px-Abierto_Mexicano_Telcel_logo.svg.png",
    "atp_chile_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5b/Chile_Open_Tennis_Logo.svg/200px-Chile_Open_Tennis_Logo.svg.png",
    "atp_indian_wells.png": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f8/BNP_Paribas_Open_logo.svg/200px-BNP_Paribas_Open_logo.svg.png",
    "atp_miami_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/32/Miami_Open_tennis_logo.svg/200px-Miami_Open_tennis_logo.svg.png",
    "atp_houston.png": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/US_Men%27s_Clay_Court_Championships_logo.svg/200px-US_Men%27s_Clay_Court_Championships_logo.svg.png",
    "atp_marrakesh.png": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a8/Grand_Prix_Hassan_II_logo.svg/200px-Grand_Prix_Hassan_II_logo.svg.png",
    "atp_monte_carlo.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/31/Monte-Carlo_Rolex_Masters_logo.svg/200px-Monte-Carlo_Rolex_Masters_logo.svg.png",
    "atp_barcelona_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/Barcelona_Open_Banc_Sabadell_logo.svg/200px-Barcelona_Open_Banc_Sabadell_logo.svg.png",
    "atp_munich_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/10/BMW_Open_logo.svg/200px-BMW_Open_logo.svg.png",
    "atp_madrid_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/Mutua_Madrid_Open_logo.svg/200px-Mutua_Madrid_Open_logo.svg.png",
    "atp_italian_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/17/Internazionali_BNL_d%27Italia_logo.svg/200px-Internazionali_BNL_d%27Italia_logo.svg.png",
    "atp_halle_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/30/Terra_Wortmann_Open_logo.svg/200px-Terra_Wortmann_Open_logo.svg.png",
    "atp_queens_club.png": "https://upload.wikimedia.org/wikipedia/en/thumb/b/bb/Cinch_Championships_logo.svg/200px-Cinch_Championships_logo.svg.png",
    "atp_eastbourne.png": "https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Rothesay_International_logo.svg/200px-Rothesay_International_logo.svg.png",
    "atp_mallorca.png": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Mallorca_Championships_logo.svg/200px-Mallorca_Championships_logo.svg.png",
    "atp_washington.png": "https://upload.wikimedia.org/wikipedia/en/thumb/9/91/Mubadala_Citi_DC_Open_logo.svg/200px-Mubadala_Citi_DC_Open_logo.svg.png",
    "atp_canadian_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/National_Bank_Open_logo.svg/200px-National_Bank_Open_logo.svg.png",
    "atp_cincinnati.png": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Western_%26_Southern_Open_logo.svg/200px-Western_%26_Southern_Open_logo.svg.png",
    "atp_chengdu_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/7/74/Chengdu_Open_logo.svg/200px-Chengdu_Open_logo.svg.png",
    "atp_japan_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/d/da/Kinoshita_Group_Japan_Open_Tennis_Championships_logo.svg/200px-Kinoshita_Group_Japan_Open_Tennis_Championships_logo.svg.png",
    "atp_shanghai_masters.png": "https://upload.wikimedia.org/wikipedia/en/thumb/d/de/Rolex_Shanghai_Masters_logo.svg/200px-Rolex_Shanghai_Masters_logo.svg.png",
    "atp_vienna_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e3/Erste_Bank_Open_logo.svg/200px-Erste_Bank_Open_logo.svg.png",
    "atp_swiss_indoors.png": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Swiss_Indoors_Basel_logo.svg/200px-Swiss_Indoors_Basel_logo.svg.png",
    "atp_paris_masters.png": "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Rolex_Paris_Masters_logo.svg/200px-Rolex_Paris_Masters_logo.svg.png",
    "atp_hamburg_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Hamburg_Open_logo.svg/200px-Hamburg_Open_logo.svg.png",
    "atp_stuttgart_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/35/MercedesCup_logo.svg/200px-MercedesCup_logo.svg.png",
    # WTA logos
    "wta_brisbane_international.png": "https://upload.wikimedia.org/wikipedia/en/thumb/b/ba/Brisbane_International_logo.svg/200px-Brisbane_International_logo.svg.png",
    "wta_auckland_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/ASB_Classic_logo.svg/200px-ASB_Classic_logo.svg.png",
    "wta_adelaide_international.png": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Adelaide_International_tennis_logo.svg/200px-Adelaide_International_tennis_logo.svg.png",
    "wta_hobart_international.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/3d/Hobart_International_tennis_logo.svg/200px-Hobart_International_tennis_logo.svg.png",
    "wta_abu_dhabi_open.png": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Abu_Dhabi_Open_logo.svg/200px-Abu_Dhabi_Open_logo.svg.png",
    "wta_qatar_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/9/93/Qatar_TotalEnergies_Open_logo.svg/200px-Qatar_TotalEnergies_Open_logo.svg.png",
    "wta_dubai_tennis_championships.png": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Dubai_Tennis_Championships_logo.svg/200px-Dubai_Tennis_Championships_logo.svg.png",
    "wta_merida_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/M%C3%A9rida_Open_Akron_logo.svg/200px-M%C3%A9rida_Open_Akron_logo.svg.png",
    "wta_atx_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/38/ATX_Open_logo.svg/200px-ATX_Open_logo.svg.png",
    "wta_indian_wells.png": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f8/BNP_Paribas_Open_logo.svg/200px-BNP_Paribas_Open_logo.svg.png",
    "wta_miami_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/3/32/Miami_Open_tennis_logo.svg/200px-Miami_Open_tennis_logo.svg.png",
    "wta_charleston_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Credit_One_Charleston_Open_logo.svg/200px-Credit_One_Charleston_Open_logo.svg.png",
    "wta_stuttgart_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/Porsche_Tennis_Grand_Prix_logo.svg/200px-Porsche_Tennis_Grand_Prix_logo.svg.png",
    "wta_madrid_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/Mutua_Madrid_Open_logo.svg/200px-Mutua_Madrid_Open_logo.svg.png",
    "wta_italian_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/1/17/Internazionali_BNL_d%27Italia_logo.svg/200px-Internazionali_BNL_d%27Italia_logo.svg.png",
    "wta_queens_club.png": "https://upload.wikimedia.org/wikipedia/en/thumb/b/bb/Cinch_Championships_logo.svg/200px-Cinch_Championships_logo.svg.png",
    "wta_berlin_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/German_Open_Tennis_logo.svg/200px-German_Open_Tennis_logo.svg.png",
    "wta_canadian_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/National_Bank_Open_logo.svg/200px-National_Bank_Open_logo.svg.png",
    "wta_cincinnati.png": "https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Western_%26_Southern_Open_logo.svg/200px-Western_%26_Southern_Open_logo.svg.png",
    "wta_wuhan_open.png": "https://upload.wikimedia.org/wikipedia/en/thumb/8/8a/Wuhan_Open_logo.svg/200px-Wuhan_Open_logo.svg.png",
    "wta_china_open_beijing.png": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/China_Open_Beijing_logo.svg/200px-China_Open_Beijing_logo.svg.png",
}

def download_logo(filename, url):
    dest = os.path.join(LOGO_DIR, filename)
    if os.path.exists(dest) and os.path.getsize(dest) > 500:
        print(f"  SKIP (exists): {filename}")
        return True
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
        if len(data) < 500:
            print(f"  SKIP (too small {len(data)}b): {filename}")
            return False
        with open(dest, 'wb') as f:
            f.write(data)
        print(f"  OK: {filename} ({len(data)} bytes)")
        return True
    except Exception as e:
        print(f"  FAIL: {filename} — {e}")
        return False

def main():
    os.makedirs(LOGO_DIR, exist_ok=True)
    print(f"Downloading logos to: {os.path.abspath(LOGO_DIR)}\n")

    success, failed = 0, []
    for filename, url in LOGO_URLS.items():
        ok = download_logo(filename, url)
        if ok:
            success += 1
        else:
            failed.append(filename)
        time.sleep(0.25)

    print(f"\n✅ Downloaded: {success}/{len(LOGO_URLS)}")
    if failed:
        print(f"❌ Failed ({len(failed)}): {', '.join(failed)}")

if __name__ == '__main__':
    main()
