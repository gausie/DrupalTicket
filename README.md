DrupalTicket
===========

This is the very early stages of an app made using the Ionic framework to
check tickets on the Drupal Commerce Event Ticket module.

Server Configuration
--------------------
Services module with user login, logout, token and ticket functions enabled.

Need to install the CORS module, with the following configuration:

`*|<mirror>|GET,PUT,POST,OPTIONS|Authorization,Origin,Content-Type,X-CSRF-Token,services_user_login_version|true`

Building the app
----------------

Have Ionic installed
`cordova plugin add https://github.com/wildabeast/BarcodeScanner.git`
