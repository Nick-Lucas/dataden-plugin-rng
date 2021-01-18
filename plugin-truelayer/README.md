# dataden-plugin-monzo

### Setup Instructions

In order to use this plugin in your own DataDen, you will need to create an API application on TrueLayer and store some credentials in DataDen

#### Create a Truelayer API App

* Go to https://console.truelayer.com/ and Sign Up, follow the instructions
  * Select "Personal Account" and follow the instructions
  * Select your country and add "Data API" access
  * When prompted to create an application, enter a sensible application name for yourself
  * Enter a **client_id** and make a note of it
  * Download your **Client Secret** and make a note of it
* With your application created
  * Switch to the Live Environment
  * Go to: "https://console.truelayer.com/settings"
    * Add the DataDen UI's URL to **"Allowed redirect URLs"** with the path "/oauth2" added
      * For instance in local development this is http://localhost:3000/oauth2
      * On a server in your network it might be like https://192.168.x.y:3000/oauth2

#### Configure DataDen

* Edit the settings of this plugin in the DataDen UI
  * Fill in the *clientId* value 
  * Fill in the *clientSecret* value
  * Save the plugin
* You should now see the plugin instance prompts you to connect your account. Follow this flow
* Your plugin is now configured and can fetch data from your linked bank account, you may add multiple instances for multiple bank accounts

#### OR Configure this plugin locally for development

* Fill in the your `emulatorSettings.json` using the example as a template
* `> yarn start` will guide you through the oauth2 flow and cache your access/refresh tokens locally in `.authcache.json`, then immediately run the plugin


<!-- TODO: add this stuff -->
add redirect URI for {localhost:3000}/oauth2
