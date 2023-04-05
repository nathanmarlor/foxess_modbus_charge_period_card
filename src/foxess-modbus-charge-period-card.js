import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.0.1/lit-element.js?module";

// (await loadCardHelpers()).createCardElement({ type: "entities", "entities": [] })
// (await window.loadCardHelpers()).createRowElement({ type: "input-number-entity" })
// (await window.loadCardHelpers()).createRowElement({ type: "input-datetime-entity" })
console.log("loaded")

class FoxESSModbusChargePeriodCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      charge_periods: [],
      config: {},
    };
  }

  get hass() {
    return this._hass
  }

  set hass(hass) {
    this._hass = hass
    console.log(hass)

    this.periods = [{ start: "00:00", end: "00:01", enable_force_charge: true, enable_charge_from_grid: false }]
  }

  async setConfig(config) {
    (await window.loadCardHelpers()).createRowElement({ type: "input-datetime-entity" })
    this.config = config;
  }

  #renderChargePeriod(charge_period) {
    return html`
      <div class="toggle-row"><p>Enable force charge:</p><ha-switch .checked=${charge_period.enable_force_charge}></ha-switch></div>
      <div class="toggle-row"><p>Enable charge from grid:</p><ha-switch .checked=${charge_period.enable_charge_from_grid}></ha-switch></div>
      <div class="range-row">
        <ha-time-input .value=${charge_period.start} .locale=${this.hass.locale}></ha-time-input>
        <div class="time-separator"></div>
        <ha-time-input .value=${charge_period.end} .locale=${this.hass.locale}></ha-time-input>
      </div>
    `;
  }

  render() {
    return html`
      <ha-card header="Test">
        <div class="card-content">
          ${this.#renderChargePeriod(this.periods[0])}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      foxess-modbus-charge-period-card {
        background-color: white;
        padding: 16px;
        display: block;
        font-size: 18px;
      }
      .toggle-row {
        display: flex;
        align-items: center;
      }
      .toggle-row p {
        flex: 1 0 auto;
      }
      .range-row {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .time-separator {
        height: 1px;
        width: 30px;
        background-color: #ededf0;
        margin: 0 10px;
      }
    `;
  }
}

customElements.define("foxess-modbus-charge-period-card", FoxESSModbusChargePeriodCard);