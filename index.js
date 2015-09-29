$(function(global) {
    'use strict';

    global.jp = global.jp || {};
    global.jp.init = init;
    global.jp.dataService = new DataService();

    function DataService() {}

    // Load places from data source (JSON file)
    DataService.prototype.getPlaces = function(searchText, callback) {
        var self = this;
        // Check if places already cached
        if (!this.places || this.places.length <= 0) {
            $.getJSON('places.json')
                .done(function(data) {
                    // Populate cache
                    self.places = data;
                    var filteredPlaces = applySearchFilter(searchText);
                    callback(null, filteredPlaces);
                })
                .fail(function(jqxhr, textStatus, error) {
                    console.log(error);
                    callback(error);
                });
        } else {
            // Places already cache
            var filteredPlaces = applySearchFilter(searchText);
            callback(null, filteredPlaces);
        }

        function applySearchFilter(searchText) {
            if (!searchText) {
                return self.places;
            }

            var results = [];
            for(var i in self.places) {
                var place = self.places[i];
                if (place.name.toLowerCase().indexOf(searchText) >= 0) {
                    results.push(place);
                    continue;
                }
                if (place.description.toLowerCase().indexOf(searchText) >= 0) {
                    results.push(place);
                    continue;
                }
                if (place.address.toLowerCase().indexOf(searchText) >= 0) {
                    results.push(place);
                    continue;
                }
            }

            return results;
        }
    };

    // Get place object by Id
    DataService.prototype.getPlace = function(placeId, callback) {
        var self = this;
        // Check if places already cached
        if (!this.places || this.places.length <= 0) {
            // Places cache is empty, populate it
            $.getJSON('places.json')
                .done(function(data) {
                    // Populate cache
                    self.places = data;
                    var place = findPlaceById(placeId);
                    callback(null, place);
                })
                .fail(function(jqxhr, textStatus, error) {
                    console.log(error);
                    callback(error);
                });
        } else {
            // Places already cache, search for it
            var place = findPlaceById(placeId);
            callback(null, place);
        }

        function findPlaceById(placeId) {
            for(var i in self.places) {
                var place = self.places[i];
                if (place.id === placeId) {
                    return place;
                }
            }
        }
    };

    // Load data about place from Wikipedia
    DataService.prototype.getWikiData = function(place, callback) {
        var url = 'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + place.name + '&format=json';
        $.ajax(url, {
            dataType: "jsonp",
            jsonpCallback : "wikicallback",
            success: function (response) {
                var results= [];
                var titleList = response[1];
                var urlList = response[3];
                for (var i = 1; i < titleList.length; i++) {
                    results.push({
                        title: titleList[i],
                        url: urlList[i]
                    });
                }

                callback(null, results);
            },
            error: function(jqxhr, textStatus, error) {
                console.log(error);
                callback(error);
            }
        });
    };

    // Load data about place from Foursquare
    DataService.prototype.getFoursquareData = function(place, callback) {
        var url = 'https://api.foursquare.com/v2/venues/search?client_id=O4JWNEBCZXMIK4G053KDL1AJKUH15RJIMFRNNCONMP2IKRQR&client_secret=OEN5NVTRJJ5LWQXMWD45C343BATOFZN2EHWBEF0CIXYMQYRU&v=20130815&ll=' + place.location;
        $.getJSON(url)
            .done(function(data) {
                var results = [];
                var venues = data.response.venues;
                for(var i in venues) {
                    var venue = venues[i];
                    results.push({
                        name: venue.name,
                        phone: (venue.contact ? venue.contact.formattedPhone : ''),
                        url: 'https://foursquare.com/v/foursquare-hq/' + venue.id,
                        id: venue.id
                    });
                }
                callback(null, results);
            })
            .fail(function(jqxhr, textStatus, error) {
                console.log(error);
                callback(error);
            });
    };

    // Load data about place from Flikr
    DataService.prototype.getFlikrData = function(place, callback) {
        var coords = place.location.split(',');
        var lat = coords[0];
        var lon = coords[1];
        var url = 'https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=05946255777e5411545bc561f0ea9c50&lat=' + lat + '&lon=' + lon + '&radius=0.5&extras=url_q&per_page=16&format=json&nojsoncallback=1';
        $.getJSON(url)
            .done(function(data) {
                var results = [];
                var photos = data.photos.photo;
                for(var i in photos) {
                    var photo = photos[i];
                    results.push({
                        imgUrl: photo.url_q,
                        ownerId: photo.owner,
                        id: photo.id,
                        webUrl: 'https://www.flickr.com/photos/' + photo.owner + '/' + photo.id + '/'
                    });
                }

                callback(null, results);
            })
            .fail(function(jqxhr, textStatus, error) {
                console.log(error);
                callback(error);
            });
    };

    function PageViewModel() {
        var self = this;
        self._searchState = undefined;

        self.searchText = ko.observable('');
        self.searchText.subscribe(function() {

            // Check if "wait-function" already started and cancel it, to avoid search on each key-press
            if (self._searchState) {
                clearTimeout(self._searchState);
                self._searchState = undefined;
            }

            self._searchState = setTimeout(function() {
                self._searchState = undefined;
                self.loadPlaces(self.searchText());
            }, 500);
        });

        self.list = new ListViewModel(this);
        self.map = new MapViewModel(this);
        self.card = new PlaceCardViewModel();

        self.showPlaceCard = function(placeId) {
            global.jp.dataService.getPlace(placeId, function(err, place) {
                self.card.show(place);
            });
        }
    }

    PageViewModel.prototype.loadPlaces = function(searchText) {
        var self = this;
        global.jp.dataService.getPlaces(searchText, function(err, data) {
            if (err) {
                console.log(err);
                return;
            }

            self.list.loadPlaces(data);
            self.map.loadPlaces(data);
        });
    };

    function ListViewModel(parent) {
        var self = this;

        self.parent = parent;

        self.items = ko.observableArray();
        self.currentPlace = ko.observable();
        self.selectPlace = function(place) {
            if (place && place.selected()) {
                return;
            }

            // Hide menu sidebar in mobile mode after click event
            var drawer = $('.mdl-layout__drawer');
            if (drawer.hasClass('is-visible')) {
                drawer.removeClass('is-visible');
            }

            self.parent.map.activateMarker(place.id());
        };
    }

    ListViewModel.prototype.loadPlaces = function(places) {
        this.items.removeAll();
        for(var i in places) {
            var place = places[i];
            this.items.push(new PlaceViewModel(place));
        }
    };

    function PlaceViewModel(place) {
        var self = this;

        self.id = ko.observable(place.id);
        self.name = ko.observable(place.name);
        self.description = ko.observable(place.description);
        self.address = ko.observable(place.address);
        self.location = ko.observable(place.location);
        self.img = ko.observable(place.img);

        // Presentation logic fields
        self.selected = ko.observable(false);
        self.visible = ko.observable(true);
    }

    function MapViewModel(parent) {
        this.parent = parent;
        this.activeMarker = undefined;
        this.markers = [];
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: 51.4841204, lng: -0.0955061},
            zoom: 11
        });
    }

    MapViewModel.prototype.loadPlaces = function(places) {

        var self = this;
        for(var mi in self.markers) {
            self.markers[mi].setMap(null);
        }

        self.markers = [];

        for(var i in places) {
            var place = places[i];
            var locParts = place.location.split(',');
            var markerCoords = { lat: parseFloat(locParts[0]), lng: parseFloat(locParts[1]) };

            var marker = new google.maps.Marker({
                map: self.map,
                position: markerCoords,
                title: place.name,
                label: place.name
            });

            marker.addListener('click', function() {
                var currentMarker = this;
                self.activateMarker(currentMarker.place.id, function() {
                    self.parent.showPlaceCard(currentMarker.place.id);
                });
            }.bind(marker));

            marker.place = place;
            self.markers.push(marker);
        }
    };

    MapViewModel.prototype.activateMarker = function(placeId, done) {

        var marker;
        // Search for marker by place Id
        for(var i in this.markers) {
            if (this.markers[i].place.id === placeId) {
                marker = this.markers[i];
                break;
            }
        }

        if (!marker) {
            done();
            return;
        }

        // Remove custom marker icon from previous marker
        if (this.activeMarker && this.activeMarker.place.id !== placeId) {
            this.activeMarker.setIcon(null);
        }

        this.activeMarker = marker;
        this.activeMarker.setIcon('img/map-marker.png');
        // Center map by current marker
        // It's convenient in mobile mode
        var locParts = this.activeMarker.place.location.split(',');
        var markerCoords = { lat: parseFloat(locParts[0]), lng: parseFloat(locParts[1]) };
        this.map.setCenter(markerCoords);

        this.bounceMarker(this.activeMarker, done);
    };

    MapViewModel.prototype.bounceMarker = function(marker, done) {
        var self = this;
        if (!!marker.getAnimation()) {
            marker.setAnimation(null);
            if (done) {
                done();
            }
        } else {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(function() {
                self.bounceMarker(marker, done);
            }, 300);
        }
    };

    function PlaceCardViewModel() {
        var self = this;

        self.visible = ko.observable(false);

        self.id = ko.observable();
        self.name = ko.observable();
        self.description = ko.observable();
        self.address = ko.observable();
        self.location = ko.observable();
        self.img = ko.observable();

        self.wikiItems = ko.observableArray();
        self.flickrItems = ko.observableArray();
        self.fourItems = ko.observableArray();

        self.flickrLoadResult = ko.observable('');
        self.flickrLoadResultVisible = ko.observable(false);
        self.fourLoadResult = ko.observable('');
        self.fourLoadResultVisible = ko.observable(false);
        self.wikiLoadResult = ko.observable('');
        self.wikiLoadResultVisible = ko.observable(false);
    }

    PlaceCardViewModel.prototype.close = function() {
        this.visible(false);
    };

    PlaceCardViewModel.prototype.show = function(place) {
        var self = this;

        self.wikiItems.removeAll();
        self.flickrItems.removeAll();
        self.fourItems.removeAll();

        self.flickrLoadResult('');
        self.flickrLoadResultVisible(false);
        self.fourLoadResult('');
        self.fourLoadResultVisible(false);
        self.wikiLoadResult('');
        self.wikiLoadResultVisible(false);

        self.id(place.id);
        self.name(place.name);
        self.description(place.description);
        self.address(place.address);
        self.location(place.location);
        self.img(place.img);

        self.visible(true);

        global.jp.dataService.getFlikrData(place, function(err, photos) {
            if (err) {
                self.flickrLoadResult(':( looks like something wrong happened... please, try again latter.');
                self.flickrLoadResultVisible(true);
                return;
            }

            if (photos.length <= 0) {
                self.flickrLoadResult('There is nothing found in Flickr.');
                self.flickrLoadResultVisible(true);
                return;
            }

            console.log(photos);

            for(var i in photos) {
                self.flickrItems.push(photos[i]);
            }
        });

        global.jp.dataService.getWikiData(place, function(err, articles) {
            if (err) {
                self.wikiLoadResult(':( looks like something wrong happened... please, try again latter.');
                self.wikiLoadResultVisible(true);
                return;
            }

            if (articles.length <= 0) {
                self.wikiLoadResult('There is nothing found in Wikipedia.');
                self.wikiLoadResultVisible(true);
                return;
            }

            console.log(articles);

            for(var i in articles) {
                self.wikiItems.push(articles[i]);
            }
        });

        global.jp.dataService.getFoursquareData(place, function(err, venues) {
            if (err) {
                self.fourLoadResult(':( looks like something wrong happened... please, try again latter.');
                self.fourLoadResultVisible(true);
                return;
            }

            if (venues.length <= 0) {
                self.fourLoadResult('There is nothing found in Foursquare.');
                self.fourLoadResultVisible(true);
                return;
            }

            console.log(venues);

            for(var i in venues) {
                self.fourItems.push(venues[i]);
            }
        });
    };

    function init() {
        // Set global default timeout value for ajax requests
        $.ajaxSetup({ timeout: 5000 });

        global.jp.pageViewModel = new PageViewModel();
        ko.applyBindings(global.jp.pageViewModel);
        global.jp.pageViewModel.loadPlaces();
    }
}(window));