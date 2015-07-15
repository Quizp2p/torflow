var DotLayer = require('./layers/dotlayer');
var MapParticleSimulation = require('./particles/mapparticlesimulation');

var PARTICLE_COUNT = 500;

var Template = require('./templates/main');

/**
 * Creates the TorFlow front-end app
 * @constructor
 */
var App = function() {

};

App.prototype = _.extend(App.prototype, {

    _clusters : {},     // zoom level -> list of clusters
    _particleSimulation : null,
    _particleLayer : null,
    _map : null,
    _element : null,
    _dateLabel : null,

    _onMapClustered : function() {
        var self = this;

        var clusterset = this._clusters[this._map.getZoom()];
        //console.log('Zoom Level : ' + this._map.getZoom() + ', Edge Count: ' + clusterset.length * clusterset.length);

        var totalBandwidth = 0;
        var nodes = clusterset.map(function(cluster) {
            var bandwidth = 0;
            cluster.getAllChildMarkers().forEach(function(child) {
                bandwidth+=child.data.circle.bandwidth;
            });
            totalBandwidth+=bandwidth;

            return {
                bandwidth : bandwidth,
                latLng: cluster._latlng
            };
        });

        nodes.forEach(function(node) {
            node.bandwidth /= totalBandwidth;
        });



        if (this._particleLayer) {
            this._map.removeLayer(this._particleLayer);
            delete this._particleLayer;
        }
        if (this._particleSimulation) {
            this._particleSimulation.stop();
            this._particleSimulation.destroy();
        }

        this._particleLayer = new DotLayer()
            .fillStyle('rgba(255,255,255,0.8');
        this._particleLayer.addTo(this._map);

        this._particleSimulation = new MapParticleSimulation(nodes,PARTICLE_COUNT,this._map)
            .start()
            .onPositionsAvailable(function(positions) {
                self._particleLayer.clear();
                positions.forEach(function(pos) {
                    self._particleLayer.add(pos);
                });
            });
    },

    _getFriendlyDate : function(daysFromMinDate) {
        return moment(this._dateBounds.min.value).add(daysFromMinDate,'day').format('dddd, MMMM Do YYYY');
    },

    _onDateChange : function() {
        var newDateIdx = this._dateSlider.slider('getValue');
        var friendlyDate = this._getFriendlyDate(newDateIdx);
        this._dateLabel.text(friendlyDate);
    },

    /**
     * Application startup.
     */
    start: function () {
        var self = this;
        var idToLatLng = {};
        
        $.get('/datebounds',function(dateBounds) {
            self._dateBounds = dateBounds;
            var totalDays = moment(dateBounds.max.value).diff(moment(dateBounds.min.value),'days') + 1;
            self._element = $(document.body).append($(Template({
                totalDates : totalDays,
                defaultIndex : totalDays,
                defaultDate : self._getFriendlyDate(totalDays)
            })));
            self._dateLabel = self._element.find('#date-label');
            self._dateSlider = self._element.find('input.slider').slider({
                tooltip:'hide'
            });
            self._dateSlider.on('slideStop',self._onDateChange.bind(self));


            self._map = L.map('map').setView([0, 0], 2);
            var mapLink = '<a href="http://openstreetmap.org">OpenStreetMap</a>';
            L.tileLayer(
                'http://{s}.tiles.mapbox.com/v3/examples.map-0l53fhk2/{z}/{x}/{y}.png', {
                    attribution: '&copy; ' + mapLink + ' Contributors',
                    maxZoom: 18,
                }).addTo(self._map);

            /* Initialize the SVG layer */
            self._map._initPathRoot();


            d3.json('/nodes', function (nodes) {

                var MIN_RADIUS = 15;
                var MAX_RADIUS = 30;

                /* Add a LatLng object to each item in the dataset */
                nodes.objects.forEach(function(d,i) {
                    d.latLng = new L.LatLng(d.circle.coordinates[0],
                        d.circle.coordinates[1]);
                    idToLatLng[d.circle.id] = d.latLng;
                });


                // Initialize zoom -> clusters map
                var minZoom = self._map.getMinZoom();
                var maxZoom = self._map.getMaxZoom();
                for (var i = minZoom; i <= maxZoom; i++) {
                    self._clusters[i] = [];
                }

                var markers = L.markerClusterGroup({
                    removeOutsideVisibleBounds : false,
                    iconCreateFunction: function (cluster) {
                        var markers = cluster.getAllChildMarkers();

                        var dataElements = markers.map(function(marker) {
                            return marker.data.circle;
                        });

                        self._clusters[self._map.getZoom()].push(cluster);

                        var bandwidth = 0;
                        dataElements.forEach(function(data) {
                            bandwidth += data.bandwidth;
                        });

                        var radius = MIN_RADIUS + (MAX_RADIUS-MIN_RADIUS)*bandwidth;

                        return L.divIcon({
                            className: 'relay-cluster',
                            iconSize: L.point(radius, radius)
                        });
                    }
                });

                markers.on('animationend', self._onMapClustered.bind(self));
                markers.on('initialized',self._onMapClustered.bind(self));

                var defaultIcon = L.divIcon({
                    className: 'relay-cluster',
                    iconSize:L.point(MIN_RADIUS, MIN_RADIUS)
                });


                nodes.objects.forEach(function(node) {
                    var title = node.circle.id;
                    var marker = L.marker(node.latLng, {icon: defaultIcon});
                    marker.data = node;
                    marker.bindPopup(title);
                    markers.addLayer(marker);
                });

                self._map.addLayer(markers);

                self._particleLayer = new DotLayer()
                    .fillStyle('rgba(255,255,255,0.8');
                self._particleLayer.addTo(self._map);

            }); 
        });
    }
});

exports.App = App;