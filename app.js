$(function(global) {
    'use strict';

    function DataService() {
        this.places = [
            {
                "id": 1,
                "name": "London eye",
                "description": "At 135m, Coca-Cola London Eye is the world’s largest cantilevered observation wheel.",
                "address": "London SE1 7PB, England, United Kingdom",
                "location": "51.503325,-0.119543",
                "img": "img/london_eye.png"
            }, {
                "id": 2,
                "name": "Tate modern",
                "description": "Tate Modern is a modern art gallery located in London.",
                "address": "Bankside, London SE1, England, United Kingdom",
                "location": "51.507625,-0.098970",
                "img": "img/tate_modern.png"
            }, {
                "id": 3,
                "name": "Royal Observatory Greenwich",
                "description": "Wren's 18th-century astronomical observatory on the Prime Meridian, now a museum with a planetarium.",
                "address": "Blackheath Ave London SE10 8XJ, England, United Kingdom",
                "location": "51.4769782,0.0",
                "img": "img/greenwich.png"
            }, {
                "id": 4,
                "name": "Buckingham Palace",
                "description": "Buckingham Palace is the London residence and principal workplace of the monarchy of the United Kingdom.",
                "address": "City of Westminster, London, England, United Kingdom",
                "location": "51.500833,-0.141944",
                "img": "img/buckingham_palace.png"
            }, {
                "id": 6,
                "name": "Tower Bridge",
                "description": "Tower Bridge (built 1886-1894) is a combined bascule and suspension bridge in London.",
                "address": "",
                "location": "51.50548,-0.07548",
                "img": "img/tower_bridge.png"
            }, {
                "id": 7,
                "name": "Hyde Park",
                "description": "Hyde Park is one of the largest parks in London, and one of the Royal Parks of London, famous for its Speakers' Corner.",
                "address": "Westminster in London, England",
                "location": "51.508611,-0.163611",
                "img": "img/hyde_park.png"
            }
        ];
    }

    /**
     * Load places from data source. Search filter applies if search text non-falsy string.
     * @param {string} searchText - string that will be used for search by name and descriptions fields of places objects.
     * @param {string} callback - function which will be called at the end of operation.
     */
    DataService.prototype.getPlaces = function(searchText, callback) {
        var self = this;
        var filteredPlaces = applySearchFilter(searchText);
        callback(null, filteredPlaces);

        function applySearchFilter(searchText) {
            if (!searchText) {
                return self.places;
            }

            var localSearchText = searchText.toLowerCase();
            var results = [];
            self.places.forEach(function(place) {
                if (place.name.toLowerCase().indexOf(localSearchText) >= 0) {
                    results.push(place);
                    return;
                }
                if (place.description.toLowerCase().indexOf(localSearchText) >= 0) {
                    results.push(place);
                    return;
                }
                if (place.address.toLowerCase().indexOf(localSearchText) >= 0) {
                    results.push(place);
                }
            });

            return results;
        }
    };

    /**
     * Get place object by id
     * @param {number} placeId - integer unique place identifier
     * @param {function} callback - function which will be called at the end of operation.
     */
    DataService.prototype.getPlace = function(placeId, callback) {
        var self = this;
        var result;
        for (var i=0; i < self.places.length; i++) {
            if (self.places[i].id === placeId) {
                result = self.places[i];
                break;
            }
        }

        callback(null, result);
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
            error: function() {
                callback(new Error('Errors occurred while loading data from wikipedia.'));
            }
        });
    };

    // Load data about place from Foursquare
    DataService.prototype.getFoursquareData = function(place, callback) {
        var url = 'https://api.foursquare.com/v2/venues/search?client_id=O4JWNEBCZXMIK4G053KDL1AJKUH15RJIMFRNNCONMP2IKRQR&client_secret=OEN5NVTRJJ5LWQXMWD45C343BATOFZN2EHWBEF0CIXYMQYRU&v=20130815&ll=' + place.location;
        $.getJSON(url)
            .done(function(data) {
                var results = [];
                data.response.venues.forEach(function(venue) {
                    results.push({
                        name: venue.name,
                        phone: (venue.contact ? venue.contact.formattedPhone : ''),
                        url: 'https://foursquare.com/v/foursquare-hq/' + venue.id,
                        id: venue.id
                    });
                });
                callback(null, results);
            })
            .fail(function() {
                callback(new Error('Errors occurred while loading data from foursquare.'));
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
                data.photos.photo.forEach(function(photo) {
                    results.push({
                        imgUrl: photo.url_q,
                        ownerId: photo.owner,
                        id: photo.id,
                        webUrl: 'https://www.flickr.com/photos/' + photo.owner + '/' + photo.id + '/'
                    });
                });
                callback(null, results);
            })
            .fail(function() {
                callback(new Error('Errors occurred while loading data from flickr.'));
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
        };
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

            self.parent.map.activateMarker(place.id(), function() {
                self.parent.showPlaceCard(place.id());
            });
        };
    }

    ListViewModel.prototype.loadPlaces = function(places) {
        this.items.removeAll();
        var self = this;
        places.forEach(function(place) {
            self.items.push(new PlaceViewModel(place));
        });
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
        this.errorText = ko.observable('');
        this.activeMarker = undefined;
        // Store places to use them after map is loaded
        this.places = [];
        this.markers = [];
        this.mapLoaded = false;

        var self = this;
        // Set timeout for g-map loaded or not, if not show message
        self.mapTimeoutFunc = setTimeout(function() {
            self.errorText("Sorry, it seems map couldn't be loaded this time. Please try a bit later.");
        }, 5000);
    }

    MapViewModel.prototype.init = function() {
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: 51.4841204, lng: -0.0955061},
            zoom: 11
        });
        this.mapLoaded = true;
        this.setMarkers();
    };

    MapViewModel.prototype.loadPlaces = function(places) {

        var self = this;
        self.places = places;

        if (self.mapLoaded) {
            self.setMarkers();
        }
    };

    MapViewModel.prototype.setMarkers = function() {
        var self = this;
        self.markers.forEach(function(marker) {
            marker.setVisible(false);
        });

        self.places.forEach(function(place) {
            // To avoid adding existing on the map markers
            var marker = getExistingMarker(self.markers, place);
            if (marker) {
                marker.setVisible(true);
                return;
            }

            var locParts = place.location.split(',');
            var markerCoords = { lat: parseFloat(locParts[0]), lng: parseFloat(locParts[1]) };

            marker = new google.maps.Marker({
                map: self.map,
                position: markerCoords,
                title: place.name,
                label: place.name
            });

            marker.addListener('click', markerOnClick.bind(marker));
            marker.place = place;
            self.markers.push(marker);
        });

        function markerOnClick() {
            var markerPlaceId = this.place.id;
            self.activateMarker(markerPlaceId, function() {
                self.parent.showPlaceCard(markerPlaceId);
            });
        }

        function getExistingMarker(markers, place) {
            for(var i =0; i < markers.length; i++) {
                if (markers[i].place && markers[i].place.id === place.id) {
                    return markers[i];
                }
            }
        }
    };

    MapViewModel.prototype.activateMarker = function(placeId, done) {

        var marker;
        // Search for marker by place Id
        for (var i=0; i < this.markers.length; i++) {
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

            photos.forEach(function(photo) {
                self.flickrItems.push(photo);
            });
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

            articles.forEach(function(article) {
                self.wikiItems.push(article);
            });
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

            venues.forEach(function(vanue) {
                self.fourItems.push(vanue);
            });
        });
    };

    // Set global default timeout value for ajax requests
    $.ajaxSetup({ timeout: 5000 });

    global.jp = global.jp || {};
    global.jp.dataService = new DataService();

    var pageViewModel = new PageViewModel();
    global.jp.pageViewModel = pageViewModel;
    ko.applyBindings(pageViewModel);
    pageViewModel.loadPlaces();

    global.jp.onMapLoaded = function() {
        clearTimeout(global.jp.pageViewModel.map.mapTimeoutFunc);
        global.jp.pageViewModel.map.init();
    };

}(window));