import {
  LitElement,
  html,
  css,
} from 'https://unpkg.com/lit-element@2.0.1/lit-element.js?module';

// Get access to ha-time-input
(await window.loadCardHelpers()).createRowElement({ type: 'input-datetime-entity' });

class FoxESSModbusChargePeriodCard extends LitElement {
  #chargePeriods = [];

  #validationMessage = null;

  constructor() {
    super();

    this.#chargePeriods = [{
      start: '00:00', end: '00:01', enableForceCharge: true, enableChargeFromGrid: true,
    }];
  }

  static get properties() {
    return {
      hass: {},
      '#chargePeriods': {
        state: true,
        type: Array,
      },
      '#validationMessage': {
        state: true,
        type: String,
      },
      config: {},
    };
  }

  get hass() {
    return this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    this.#loadEntityIds();
  }

  async setConfig(config) {
    this.config = config;
  }

  async #loadEntityIds() {
    try {
      const result = await this._hass.callWS({ type: 'foxess_modbus/get_charge_periods', inverter: '' });
      console.log(result);
    } catch (error) {
      console.log(error);
    }
  }

  #renderChargePeriod(chargePeriod) {
    return html`
      <div class="toggle-row">
        <p>Enable force charge:</p>
        <ha-switch
          ?checked=${chargePeriod.enableForceCharge}
          @change=${(e) => { chargePeriod.enableForceCharge = e.target.checked; this.#inputChanged(); }}></ha-switch>
      </div>
      <div class="toggle-row">
        <p>Enable charge from grid:</p>
        <ha-switch
          ?checked=${chargePeriod.enableChargeFromGrid}
          @change=${(e) => { chargePeriod.enableChargeFromGrid = e.target.checked; this.#inputChanged(); }}></ha-switch>
      </div>
      <div class="range-row">
        <ha-time-input
          .value=${chargePeriod.start}
          .locale=${this.hass.locale}
          ?disabled=${!chargePeriod.enableForceCharge}
          @value-changed=${(e) => { chargePeriod.start = e.target.value; this.#inputChanged(); }}></ha-time-input>
        <div class="time-separator"></div>
        <ha-time-input
          .value=${chargePeriod.end}
          .locale=${this.hass.locale}
          ?disabled=${!chargePeriod.enableForceCharge}
          @value-changed=${(e) => { chargePeriod.end = e.target.value; this.#inputChanged(); }}></ha-time-input>
      </div>
    `;
  }

  render() {
    return html`
      <ha-card header="Charge Windows">
        <div class="card-content">
          ${this.#renderChargePeriod(this.#chargePeriods[0])}

          <p>${this.#validationMessage}</p>

          <div class="button-row">
            <mwc-button label="Reset"></mwc-button>
            <mwc-button
              label="Save"
              ?disabled=${this.#validationMessage != null}></mwc-button>
          </div>
        </div>
      </ha-card>
    `;
  }

  #inputChanged() {
    console.log(this.#chargePeriods);
    this.requestUpdate();

    if (this.#chargePeriods[0].enableForceCharge) {
      this.#validationMessage = 'Test...';
    } else {
      this.#validationMessage = null;
    }
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
      .button-row {
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
      }
    `;
  }
}

customElements.define('foxess-modbus-charge-period-card', FoxESSModbusChargePeriodCard);
