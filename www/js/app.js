/**
 * DrupalTicket Core
 */

var DrupalTicket = angular.module('DrupalTicket', [
  'ionic',
  'ngCordova',
  'ngResource',
  'ngCookies'
]);

DrupalTicket.run(['$ionicPlatform', '$cookies', 'Site', '$http',
  function($ionicPlatform, $cookies, Site, $http) {
    $ionicPlatform.ready(function() {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      if(window.cordova && window.cordova.plugins.Keyboard) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      }
      if(window.StatusBar) {
        StatusBar.styleDefault();
      }
    });

    /**
     * In the newer version of Angular this will be:
     *     $cookies.remove('XSRF-TOKEN');
     *     Site.token().$promise.then(function(token) {
     *       $cookies.put('XSRF-TOKEN', token.token);
     *     });
     */
    delete $cookies['XSRF-TOKEN'];
    Site.token().$promise.then(function(token) {
      $cookies['XSRF-TOKEN'] = token.token;
    });
  }
])

DrupalTicket.config(function($httpProvider, $stateProvider, $urlRouterProvider) {
  // Chang the XSRF header name to match Drupal's token.
  $httpProvider.defaults.xsrfHeaderName = 'X-CSRF-TOKEN';

  // Automatically route users to login.
  $urlRouterProvider.otherwise('/login');
});

DrupalTicket.controller('appController', ['$scope', 'Config', 'Site',
  function($scope, Config, Site) {
    // Attach Config variables to the scope.
    $scope.user = Site.user;
    $scope.Config = Config;

    $scope.logout = function() {
      Site.logout().$promise.then(function() {
        console.log(arguments);
      });
    };
  }
]);

/**
 * Resources
 */
DrupalTicket.factory('Site', ['$resource', 'Config',
  function($resource, Config) {
    var resource = $resource(Config.endpointUrl + 'user', null, {
      token: {
        url: Config.endpointUrl + 'user/token',
        method: 'POST'
      },
      connect: {
        url: Config.endpointUrl + 'system/connect',
        method: 'POST'
      },
      login: {
        url: Config.endpointUrl + 'user/login',
        method: 'POST',
        headers: {
          'services_user_login_version': '1.0'
        }
      },
      logout: {
        url: Config.endpointUrl + 'user/logout',
        method: 'POST',
        headers: {
          'services_user_login_version': '1.0'
        }
      }
    });

    resource.user = null;

    return resource;
  }
]);

DrupalTicket.factory('Ticket', ['$resource', 'Config',
  function($resource, Config) {
    return $resource(Config.endpointUrl + 'event-ticket/:code', { code: '@code' }, {
      validate: {
        method: 'POST',
        url: Config.endpointUrl + 'event-ticket/:code/validate'
      }
    });
  }
]);

/**
 * DrupalTicket Login
 */
DrupalTicket.config(function($stateProvider) {
  $stateProvider.state('login', {
    abstract: true,
    url: '/login',
    template: '<ion-nav-view></ion-nav-view>'
  }).state('login.index', {
    url: '',
    templateUrl: 'views/login.html'
  }).state('login.local', {
    url: '/local',
    templateUrl: 'views/login.local.html'
  });
});

DrupalTicket.controller('loginController', ['$scope', '$rootScope', '$state', '$cordovaInAppBrowser', '$cookies', 'Config', 'Site',
  function($scope, $rootScope, $state, $cordovaInAppBrowser, $cookies, Config, Site) {
    $scope.user = Site.user;

    $scope.localLogin = function() {
      Site.login({
        username: $scope.username,
        password: $scope.password
      }).$promise.then(function(response) {
        $cookies['XSRF-TOKEN'] = response.token;
        $scope.user = response.user;
        $state.go('scan');
      }).catch(function(err) {
        console.log('Login failed');
      });
    };

    $scope.shibbolethLogin = function() {
      $cordovaInAppBrowser.open(Config.auth.url, '_blank', {
        location: 'no',
        toolbar: 'no',
        clearsessioncache: 'yes'
      });

      // Insert code to make the login page mobile compatable.
      $rootScope.$on('$cordovaInAppBrowser:loadstop', function(e, event) {
        if (e.url === Config.auth.login) {
          $cordovaInAppBrowser.insertCSS({ code: "*{max-width:100%!important;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}#sidebarLeft{display:none!important}#wrap{background:none!important}#main{padding-bottom:0!important}#main form{width:100%!important}#corp-identity-bright-blue *,#footer,#header h1{display:none}" });
          $cordovaInAppBrowser.executeScript({ code: "(function(){var e=document.createElement('meta');e.id='viewport';e.name='viewport';e.content='width=device-width, initial-scale=1, maximum-scale=3, minimum-scale=1, user-scalable=yes';document.getElementsByTagName('head')[0].appendChild(e)})()" });
        }
      });

      $rootScope.$on('$cordovaInAppBrowser:loadstart', function(e, event) {
        if (e.url === Config.auth.success) {
          $cordovaInAppBrowser.close();
          Site.connect().$promise.then(function(response) {
            $scope.user = response.user;
            $state.go('scan');
          });
        }
      });
    };
  }
]);

/**
 * Scanning
 */
DrupalTicket.config(function($stateProvider) {
  $stateProvider.state('scan', {
    url: '/scan',
    templateUrl: 'views/scan.html'
  });
});

DrupalTicket.controller('scanController', ['$scope', '$rootScope', '$state', '$cordovaBarcodeScanner', 'Config', 'Site', 'Ticket',
  function($scope, $rootScope, $state, $cordovaBarcodeScanner, Config, Site, Ticket) {
    $scope.user = Site.user;
    $scope.error;
    $scanning = false;

    $scope.scan = function() {
      document.addEventListener("deviceready", function () {
        $cordovaBarcodeScanner.scan().then(function(barcodeData) {
          // Stop if cancelled
          if (barcodeData.cancelled) {
            return false;
          }

          // Get the barcode
          var code = barcodeData.text;

          // Shouldn't be longer than 50 chars.
          if(code.length > 50){
            $scope.error = "Code too long";
            return false;
          }

          return code;
        }).then(function(code){

          // Get the Ticket
          return Ticket.get({
            code: code
          }).$promise;

        }).then(function() {
          return ticket.$validate(function(){
            $scanning = false;
          }).$promise;
        }).then(function() {
          // Validated!
        }).catch(function(error) {
          $scope.error = error;
        });
      }, false);
    };
  }
]);
