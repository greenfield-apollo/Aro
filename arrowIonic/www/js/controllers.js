angular.module('starter.controllers', [])

.controller('MapCtrl', function($rootScope, $scope, $state, $ionicPopup, $ionicModal, $cordovaGeolocation, Auth) {
  $scope.mode = 'hunt';
  $scope.waypoints = [];
  $scope.waypointList = [];
  $scope.searchCircles = [];
  $scope.selectedID = null;
  $scope.scavenger = false;
  $rootScope.huntProgress = null;
  $rootScope.previousLocation = null;
  $rootScope.nextDestination = null;
  $scope.newHunt = {};
  var labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var preIcon = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter_withshadow&chld=';
  var geo = google.maps.geometry.spherical;

  $ionicModal.fromTemplateUrl('save-modal.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.saveModal = modal;
  });

  $scope.$on('modal.hidden', function() {
    delete $scope.newHunt.name;
    delete $scope.newHunt.scavenger;
  });

  $rootScope.createHunt = function() {
    $scope.mode = 'create';
    $scope.clearWaypoints();
    $state.go('tab.map');
  };

  $rootScope.loadHunt = function(hunt) {
    console.log(hunt);
    $scope.mode = 'hunt';
    $scope.huntName = hunt.name;
    $scope.clearWaypoints();
    $scope.scavenger = hunt.scavenger;
    $scope.setWaypoints(hunt.waypoints);
    $rootScope.huntProgress = null;
    $scope.getNextDestination();
    $state.go('tab.compass');
  };

  $scope.preSave = function() {
    var savedHunt = {
      name: $scope.newHunt.name,
      waypoints: $scope.waypointList,
      scavenger: $scope.newHunt.scavenger || false
    };

    for (var i = 0, j = savedHunt.waypoints.length; i < j; i++) {
      savedHunt.waypoints[i].position = {
        J: savedHunt.waypoints[i].position.lat(),
        M: savedHunt.waypoints[i].position.lng()
      };
    }

    $rootScope.saveHunt(savedHunt);
    $scope.saveModal.hide();

    $scope.mode = 'hunt';
    $scope.clearWaypoints();
    $rootScope.huntProgress = null;
    $state.go('tab.hunt');
  };

  $scope.goToLoad = function() {
    $state.go('tab.hunt');
  };

  $scope.setWaypoints = function(waypointList) {
    for (var i = 0, j = waypointList.length; i < j; i++) {
      waypointList[i].position = new google.maps.LatLng(waypointList[i].position.J, waypointList[i].position.M);
      var waypoint = new google.maps.Marker({
        map: $scope.map,
        icon: preIcon + labels[i % labels.length] + '|F78181',
        position: waypointList[i].position
      });

      var circle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        map: $scope.map,
        center: geo.computeOffset(waypointList[i].position, Math.random() * 450, Math.random() * 360),
        radius: 500,
        visible: false
      });

      if ($scope.scavenger) {
        waypoint.setVisible(false);
      }

      waypoint.id = i;

      google.maps.event.addListener(waypoint, 'click', function() {
        $scope.selectedID = this.id;
        infowindow.setContent($scope.waypointList[this.id].name);
        infowindow.open($scope.map, this);
      });

      $scope.waypoints.push(waypoint);
      $scope.searchCircles.push(circle);
    }

    $scope.waypointList = waypointList;
  };

  $scope.clearWaypoints = function() {
    for (var i = 0, j = $scope.waypoints.length; i < j; i++) {
      $scope.waypoints[i].setMap(null);
      $scope.waypoints[i] = null;
    }

    for (var i = 0, j = $scope.searchCircles.length; i < j; i++) {
      $scope.searchCircles[i].setMap(null);
      $scope.searchCircles[i] = null;
    }

    $scope.waypoints = [];
    $scope.waypointList = [];
    $scope.searchCircles = [];
  };

  $scope.zoom = function() {
    if ($scope.map.zoom === 15) {
      $scope.map.setZoom(10);
    } else if ($scope.map.zoom === 10) {
      $scope.map.setZoom(5);
    } else {
      $scope.map.setZoom(15);
    }
  };

  var initialize = function() {
    var getLocation = function() {
      $cordovaGeolocation.getCurrentPosition(watchOptions)
        .then(refreshLocation, function(error) {
          console.log('Could not get current location');
          setTimeout(getLocation, 1000);
        });
    };

    var refreshLocation = function(currentPosition) {
      $scope.currentPosition = new google.maps.LatLng(currentPosition.coords.latitude, currentPosition.coords.longitude);
      $scope.currentMarker.setPosition($scope.currentPosition);

      if ($scope.mode === 'hunt' && $rootScope.nextDestination) {
        $rootScope.destHeading = geo.computeHeading($scope.currentPosition, $rootScope.nextDestination.position);
        $rootScope.distance =
          geo.computeDistanceBetween($scope.currentPosition, $rootScope.nextDestination.position) * 0.00062137; // meters -> miles
        if ($rootScope.distance < 0.1) {
          $scope.getNextDestination();
        }
      }
      setTimeout(getLocation, 1000);
    };

    var initializeMap = function() {
      var mapOptions = {
        center: $scope.currentPosition,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: true,
        disableDoubleClickZoom: true,
      };

      $scope.map = new google.maps.Map(document.getElementById("map"), mapOptions);

      google.maps.event.addDomListener($scope.map, 'click', function(e){
        $scope.mousePosition = e.latLng;
        $scope.selectedID = null;
        infowindow.close();
      });

      setTimeout(getLocation, 1000);
    };

    var watchOptions = {
      maximumAge: 3000,
      timeout: 5000,
      enableHighAccuracy: true
    };

    // Get user's current geolocation
    $cordovaGeolocation.getCurrentPosition(watchOptions)
      .then(function(currentPosition) {
        $scope.currentPosition = new google.maps.LatLng(currentPosition.coords.latitude, currentPosition.coords.longitude);
        $scope.geocoder = new google.maps.Geocoder();
        initializeMap();

        // Create a marker representing user's current location
        var image = 'img/current.png';
        $scope.currentMarker = new google.maps.Marker({
          position: $scope.currentPosition,
          map: $scope.map,
          icon: image
        });

        google.maps.event.addListener($scope.currentMarker, 'click', function() {
          event.stopPropagation();
        });

      }, function(error) {
        console.log('Could not get current location');
      });
  };

  var infowindow = new google.maps.InfoWindow({content: 'Selected'});

  google.maps.event.addListener(infowindow, 'closeclick', function() {
    $scope.selectedID = null;
  });

  $scope.getNextDestination = function() {
    if ($rootScope.huntProgress === null) {
      if ($scope.waypointList.length > 0) {
        $rootScope.nextDestination = $scope.waypointList[0];
        $rootScope.huntProgress = 0;
        if ($scope.scavenger) {
          $scope.searchCircles[0].setVisible(true);
        }
      }
    } else {
      $scope.waypoints[$rootScope.huntProgress]
        .setIcon(preIcon + labels[$rootScope.huntProgress % labels.length] + '|2EFE64');
      $scope.waypoints[$rootScope.huntProgress].setVisible(true);
      $scope.searchCircles[$rootScope.huntProgress].setVisible(false);

      $rootScope.previousLocation = $scope.waypointList[$rootScope.huntProgress];
      $rootScope.huntProgress++;

      if ($scope.waypointList[$rootScope.huntProgress]) {
        if ($scope.scavenger) {
          $scope.searchCircles[$rootScope.huntProgress].setVisible(true);
        }
        $rootScope.nextDestination = $scope.waypointList[$rootScope.huntProgress]
      } else {
        $rootScope.nextDestination = null;
      }
    }
  };

  $scope.currentLocation = function() {
    $scope.map.setCenter($scope.currentPosition);
    infowindow.close();
  };

  $scope.goToStart = function() {
    $scope.selectedID = 0;
    $scope.map.setCenter($scope.waypoints[0].position);
    infowindow.setContent($scope.waypointList[0].name);
    infowindow.open($scope.map, $scope.waypoints[0]);
  };

  $scope.previousWaypoint = function() {
    $scope.map.setCenter($scope.waypoints[--$scope.selectedID].position);
    infowindow.setContent($scope.waypointList[$scope.selectedID].name);
    infowindow.open($scope.map, $scope.waypoints[$scope.selectedID]);
  };

  $scope.nextWaypoint = function() {
    $scope.map.setCenter($scope.waypoints[++$scope.selectedID].position);
    infowindow.setContent($scope.waypointList[$scope.selectedID].name);
    infowindow.open($scope.map, $scope.waypoints[$scope.selectedID]);
  };

  $scope.createWaypoint = function() {
    if ($scope.mode === 'create' && $scope.mousePosition) {
      var waypoint = new google.maps.Marker({
        map: $scope.map,
        animation: google.maps.Animation.DROP,
        icon: preIcon + labels[$scope.waypoints.length % labels.length] + '|F78181',
        draggable: true,
        position: $scope.mousePosition
      });

      $scope.mousePosition = null;

      waypoint.id = $scope.waypoints.length;
      $scope.waypointInfo = {position: waypoint.position};

      var cancel = false;

      var waypointNameEditor = $ionicPopup.show({
        template: '<input type="text" ng-model="waypointInfo.name">',
        title: 'Enter Waypoint Name',
        scope: $scope,
        buttons: [
          {
            text: 'Cancel',
            onTap: function() {
              cancel = true;
            }
          },

          {
            text: 'Next',
            type: 'button-positive',
            onTap: function(e) {
              if (!$scope.waypointInfo.name) {
                e.preventDefault();
              }
            }
          }
        ]
      });

      waypointNameEditor.then(function() {
        if (cancel) {
          waypoint.setMap(null);
          waypoint = null;
          return;
        } else {
          var waypointDescEditor = $ionicPopup.show({
            template: '<textarea rows="6" maxlength="200" ng-model="waypointInfo.description">',
            title: 'Enter Waypoint Description',
            scope: $scope,
            buttons: [
              {
                text: 'Cancel',
                onTap: function() {
                  cancel = true;
                }
              },

              {
                text: 'Save',
                type: 'button-positive',
                onTap: function(e) {
                  if (!$scope.waypointInfo.description) {
                    e.preventDefault();
                  }
                }
              }
            ]
          });

          waypointDescEditor.then(function() {
            if (cancel) {
              waypoint.setMap(null);
              waypoint = null;
              return;
            } else {
              google.maps.event.addListener(waypoint, 'click', function() {
                $scope.selectedID = this.id;
                infowindow.setContent($scope.waypointList[this.id].name);
                infowindow.open($scope.map, this);
              });

              google.maps.event.addListener(waypoint, 'dragend', function() {
                $scope.waypointList[this.id].position = this.getPosition();
              });

              $scope.waypoints.push(waypoint);
              $scope.waypointList.push($scope.waypointInfo);
            }
          });
        }
      });
    }
  };

  $scope.deleteWaypoint = function() {
    $scope.waypoints[$scope.selectedID].setMap(null);
    $scope.waypoints[$scope.selectedID] = null;
    $scope.waypoints.splice($scope.selectedID, 1);

    // update existing waypoints after removing one
    for (var i = $scope.selectedID, j = $scope.waypoints.length; i < j; i++) {
      $scope.waypoints[i].id = i;
      $scope.waypoints[i].setIcon(preIcon + labels[i % labels.length] + '|F78181');
    }

    $scope.waypointList.splice($scope.selectedID, 1);
    $scope.selectedID = null;
  };

  // geocodes a human readable address & stores long/lat in var coordsResult
  $scope.geocodeAddress = function(geocoder, map) {

    var address = document.getElementById('address').value;

    $scope.geocoder.geocode({'address': address}, function(results, status) {
      if (status === google.maps.GeocoderStatus.OK) {
        $scope.map.setCenter(results[0].geometry.location);
        var coordsResult = results[0].geometry.location;
      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    });

  };

  $scope.login = function() {
    Auth.$authWithOAuthRedirect("github").then(function(authData) {
      // User successfully logged in
    }).catch(function(error) {
      if (error.code === "TRANSPORT_UNAVAILABLE") {
        console.log(error.code);
        Auth.$authWithOAuthPopup("github").then(function(authData) {
          // User successfully logged in. We can log to the console
          // since we’re using a popup here
          console.log(authData);
        });
      } else {
        // Another error occurred
        console.log(error);
      }
    });
    Auth.$onAuth(function(authData) {
      if (authData === null) {
        console.log("Not logged in yet");
      } else {
        console.log("Logged in as", authData.uid);
      }
      $scope.authData = authData; // This will display the user's name in our view
    });
  };

  document.addEventListener('deviceready', initialize, false);
})

  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //
  //$scope.$on('$ionicView.enter', function(e) {
  //});


.controller('CompassCtrl', function($rootScope, $scope, $state, $cordovaDeviceOrientation, $cordovaGeolocation, $ionicScrollDelegate) {
  document.addEventListener("deviceready", function () {
    var locationOptions = {
      maximumAge: 3000,
      timeout: 5000,
      enableHighAccuracy: true // may cause errors if true
    };

    var orientationOptions = {frequency: 100};   // how often the watch updates

    $scope.watch = $cordovaDeviceOrientation.watchHeading(orientationOptions).then(
      null,
      function(err) {
        $scope.heading = err;
      },
      function(result) {
        if ($rootScope.nextDestination) {
          $scope.rotation = 'transform: rotate('+ Math.floor($rootScope.destHeading - result.magneticHeading) +'deg)';
        } else {
          $scope.rotation = 'transform: rotate(0deg)';
        }
      });

    }, false);
})


.controller('HuntCtrl', function($rootScope, $scope, Hunts ) {

  $scope.allHunts = Hunts

  console.log($scope.allHunts);

  $rootScope.saveHunt = function(hunt) {
    $scope.allHunts.$add(hunt);
    console.log($scope.allHunts);
  };

});

