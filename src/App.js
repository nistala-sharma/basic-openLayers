import React, { useState, useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import 'ol/ol.css';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Draw, Modify, Translate } from 'ol/interaction';
import GeoJSON from 'ol/format/GeoJSON';
import { Select, MenuItem, Button, FormControlLabel, Checkbox } from '@mui/material';
import { Style, Fill, Stroke } from 'ol/style';

function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [layerType, setLayerType] = useState('osm');
  const [drawInteraction, setDrawInteraction] = useState(null);
  const vectorSource = useRef(new VectorSource()); 
  const [geoJsonLayers, setGeoJsonLayers] = useState([]); 
  const [showAllLayers, setShowAllLayers] = useState(true); 
  const [activeLayer, setActiveLayer] = useState(null); 

  useEffect(() => {
    const initialMap = new Map({
      target: mapRef.current,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
    });

    // Add a vector layer for drawing points, lines, polygons
    const vectorLayer = new VectorLayer({
      source: vectorSource.current,
    });
    initialMap.addLayer(vectorLayer);

    setMap(initialMap);

    return () => {
      initialMap.setTarget(null);
    };
  }, []);

  useEffect(() => {
    if (map) {
      let newLayer;

      if (layerType === 'osm') {
        newLayer = new TileLayer({
          source: new OSM(),
        });
      } else if (layerType === 'satellite') {
        newLayer = new TileLayer({
          source: new XYZ({
            url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          }),
        });
      }

      map.getLayers().clear();
      map.addLayer(newLayer);

      // Re-add vector layers and GeoJSON layers
      map.addLayer(new VectorLayer({ source: vectorSource.current }));
      geoJsonLayers.forEach(layer => {
        map.addLayer(layer);
      });
    }
  }, [layerType, map, geoJsonLayers]);

  const handleLayerChange = (e) => {
    setLayerType(e.target.value);
  };

  const addDrawInteraction = (type) => {
    if (!map) return;

    // Remove any existing drawing interaction
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      setDrawInteraction(null);
    }

    // Add a new draw interaction (Point, LineString, or Polygon)
    const draw = new Draw({
      source: vectorSource.current,
      type: type,
    });

    draw.on('drawend', (event) => {
      console.log(`${type} coordinates: `, event.feature.getGeometry().getCoordinates());
      map.removeInteraction(draw); // Remove the interaction after drawing
      setDrawInteraction(null);
    });

    map.addInteraction(draw);
    setDrawInteraction(draw);
  };

  const handleGeoJSONImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const geojsonData = event.target.result;
        const geojsonFormat = new GeoJSON();
        const features = geojsonFormat.readFeatures(geojsonData, {
          featureProjection: 'EPSG:3857', 
        });

       
        const geoJsonVectorSource = new VectorSource({
          features: features,
        });
        const newGeoJsonLayer = new VectorLayer({
          source: geoJsonVectorSource,
          style: new Style({
            fill: new Fill({ color: 'rgba(255, 255, 255, 0.6)' }),
            stroke: new Stroke({ color: '#319FD3', width: 1 }),
          }),
        });

        // Add the new GeoJSON layer to the map
        map.addLayer(newGeoJsonLayer);
        setGeoJsonLayers([...geoJsonLayers, newGeoJsonLayer]); // Add to layer list
      };
      reader.readAsText(file);
    }
  };

  const handleShowHideAll = () => {
    geoJsonLayers.forEach(layer => {
      layer.setVisible(!showAllLayers);
    });
    setShowAllLayers(!showAllLayers);
  };

  const handleLayerAction = (action, layer) => {
    switch (action) {
      case 'zoom':
        map.getView().fit(layer.getSource().getExtent(), { duration: 1000 });
        break;
      case 'delete':
        map.removeLayer(layer);
        setGeoJsonLayers(geoJsonLayers.filter(l => l !== layer));
        break;
      case 'download':
        const geojsonFormat = new GeoJSON();
        const data = geojsonFormat.writeFeatures(layer.getSource().getFeatures(), {
          featureProjection: 'EPSG:3857',
        });
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'layer.geojson';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        break;
      case 'showHide':
        layer.setVisible(!layer.getVisible());
        break;
      default:
        break;
    }
  };

  const handleModifyFeatures = () => {
    const modify = new Modify({ source: vectorSource.current });
    map.addInteraction(modify);
  };

  const handleTranslateFeatures = () => {
    const translate = new Translate({ features: vectorSource.current.getFeatures() });
    map.addInteraction(translate);
  };

  const handleStyleChange = (layer, property, value) => {
    const layerStyle = layer.getStyle() || new Style();
    const stroke = layerStyle.getStroke() || new Stroke();
    const fill = layerStyle.getFill() || new Fill();

    if (property === 'color') stroke.setColor(value);
    if (property === 'strokeWidth') stroke.setWidth(value);
    if (property === 'fillOpacity') fill.setColor(`rgba(255, 255, 255, ${value})`);

    layerStyle.setStroke(stroke);
    layerStyle.setFill(fill);
    layer.setStyle(layerStyle);
  };

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: '100vh' }} />

      
      <Select
        labelId="select-layer"
        id="simple-select-layer"
        value={layerType}
        label="layerType"
        onChange={handleLayerChange}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: '100',
          opacity: '1',
          background: 'white',
        }}
      >
        <MenuItem value={'osm'}>OSM</MenuItem>
        <MenuItem value={'satellite'}>Satellite</MenuItem>
      </Select>

     
      <Button
        variant="contained"
        color="primary"
        onClick={() => addDrawInteraction('Point')}
        style={{ position: 'absolute', top: '50px', right: '10px', zIndex: '100' }}
      >
        Draw Point
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => addDrawInteraction('LineString')}
        style={{ position: 'absolute', top: '100px', right: '10px', zIndex: '100' }}
      >
        Draw Line
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => addDrawInteraction('Polygon')}
        style={{ position: 'absolute', top: '150px', right: '10px', zIndex: '100' }}
      >
        Draw Polygon
      </Button>

      
      <Button
        variant="contained"
        color="secondary"
        onClick={handleModifyFeatures}
        style={{ position: 'absolute', top: '200px', right: '10px', zIndex: '100' }}
      >
        Modify Features
      </Button>
      <Button
        variant="contained"
        color="secondary"
        onClick={handleTranslateFeatures}
        style={{ position: 'absolute', top: '250px', right: '10px', zIndex: '100' }}
      >
        Translate Features
      </Button>

      
      <Button
        variant="contained"
        component="label"
        style={{ position: 'absolute', top: '300px', right: '10px', zIndex: '100' }}
      >
        Import GeoJSON
        <input
          type="file"
          accept=".geojson"
          style={{ display: 'none' }}
          onChange={handleGeoJSONImport}
        />
      </Button>

      
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'white',
          padding: '10px',
          zIndex: '100',
        }}
      >
        <FormControlLabel
          control={<Checkbox checked={showAllLayers} onChange={handleShowHideAll} />}
          label="Show/Hide All Layers"
        />

        {geoJsonLayers.map((layer, index) => (
          <div key={index}>
            <p>Layer {index + 1}</p>
            <Button onClick={() => handleLayerAction('zoom', layer)}>Zoom to Layer</Button>
            <Button onClick={() => handleLayerAction('delete', layer)}>Delete Layer</Button>
            <Button onClick={() => handleLayerAction('download', layer)}>Download Layer</Button>
            <Button onClick={() => handleLayerAction('showHide', layer)}>
              {layer.getVisible() ? 'Hide' : 'Show'} Layer
            </Button>

           
            <div>
              <input
                type="color"
                onChange={(e) => handleStyleChange(layer, 'color', e.target.value)}
                defaultValue="#319FD3"
              />
              <input
                type="range"
                min="1"
                max="10"
                onChange={(e) => handleStyleChange(layer, 'strokeWidth', e.target.value)}
                defaultValue="1"
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                onChange={(e) => handleStyleChange(layer, 'fillOpacity', e.target.value)}
                defaultValue="0.6"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
