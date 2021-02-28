# dataden-plugin-ig

Adds IG Trading support, with full support for stock-trading & ISA accounts, and partial support for CFD/Spread-Betting accounts

| Loader            | Description                                                                 | Implemented |
| ----------------- | --------------------------------------------------------------------------- | ----------- |
| User              | User and accounts metadata for display purposes.                            | ✅           |
| Portfolio Summary | Historical portfolio performance data. Replays all trades and transactions. | ✅           |
| Stock Performance | Summary of performance in individual markets                                | 🔴           |

### Setup Instructions

In order to use this plugin in your own DataDen, you just need your IG Trading credentials. IG do not offer a public API with an alternative authentication method, at least with support for stock trading, so this plugin has to use them application API to fetch data.

#### Configure DataDen

* Edit the settings of this plugin in the DataDen UI
  * Update *backdateToISO* with a valid ISO date, ideally the year/date you opened your account to minimise wasteful requests. The default should be a fine starting point.
  * Fill in the *igUsername* value 
  * Fill in the *igPassword* value
  * Update in any other default settings to your taste
  * Save the plugin
* The plugin will now sync as you have configured it

#### Configuring this plugin locally for development

* Fill in the your `emulatorSettings.json` using the example as a template
* `> yarn start` will run the plugin and dump result to the output/ directory
