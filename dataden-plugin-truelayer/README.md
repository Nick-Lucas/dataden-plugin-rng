# dataden-plugin-monzo

### Setup Instructions

In order to use this plugin in your own DataDen, you will need to create an API application on TrueLayer and store some credentials in DataDen

#### Create a Truelayer API App

* Go to https://console.truelayer.com/ and Sign Up, follow the instructions
  * Select "Personal Account" and follow the instructions
  * Select your country and "Data API"
  * When prompted to create an application, enter a sensible application name for yourself
  * Enter a client_id and make a note of it
  * Download your Client Secret and make a note of it
* With your application created
  * Navigate to the Live Environment
  * Navigate to "Data API", then "Auth Link Builder"
  * Search for your "Authentication link"
    * It will start something like: "https://auth.truelayer.com/?response_type=code&client_id............"
    * Open the link in your browser. (At this point you will see a banner warning you the app is not for production use, it will still work)
    * Select your banking provider and follow the instructions
    * Grab your "code" and take note of it for later

####
