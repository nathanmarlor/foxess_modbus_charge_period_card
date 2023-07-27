# FoxESS - Modbus Charge Period Card

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE)

## Introduction

This is lovelace card which works with the [Foxess - Modbus integration](https://github.com/nathanmarlor/foxess_modbus/) to let you set and configure charge periods.

This is supported by the following inverters:

* H1 (including AC1 and AIO) using RS485
* KH using RS485

<p align="center">
    <img src="https://github.com/nathanmarlor/foxess_modbus_charge_period_card/blob/main/images/overview.png" width="50%"/>
</p>

This provides the same functionality as the FoxESS app.

## Installation

First, make sure that you have installed the [Foxess - Modbus integration](https://github.com/nathanmarlor/foxess_modbus/) **version 1.7.0 or higher**, and have configured at least one supported inverter.

Recommend installation is through [HACS](https://hacs.xyz/).

1. Navigate to "HACS" in the left menu
2. Select "Frontend"
3. Hit the menu button (top right) and select "Custom repositories"
4. Paste [`https://github.com/nathanmarlor/foxess_modbus_charge_period_card`](https://github.com/nathanmarlor/foxess_modbus_charge_period_card) into "Repository", and set "Category" to "Lovelace"
5. Install as usual through HACS:
    1. "Explore & Download Repositories"
    2. Search for "FoxESS - Modbus: Charge Period Card"
    3. Click "Download"
    4. When prompted, click "Reload"

Then add it to one of your dashboards

1. On a dashboard, select "Edit Dashboard" then "Add Card"
2. Search for "FoxESS - Modbus: Charge Period Card", and select
3. Select your inverter using the drop-downe
4. Click "Save"

## Usage

* `Enable Charge Period`: Whether the charge period is enabled. A charge period will prevent your batteries from discharging between the specified times.
* `Enable charge from grid`: If selected, your batteries will charge from the grid during this period. If deselected, your batteries won't charge or discharge.

After making changes, click "Save" to save them to your inverter.

---

[releases-shield]: https://img.shields.io/github/release/nathanmarlor/foxess_modbus_charge_period_card.svg?style=for-the-badge
[releases]: https://github.com/nathanmarlor/foxess_modbus_charge_period_card/releases
[license-shield]: https://img.shields.io/github/license/nathanmarlor/foxess_modbus_charge_period_card.svg?style=for-the-badge
