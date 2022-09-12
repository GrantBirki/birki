import React, { Component } from 'react';
import Typist from 'react-typist';
import './App.css';
import Configs from './configurations.json';
import WebGLFluid from 'webgl-fluid'

WebGLFluid(document.querySelector('canvas'), {
  IMMEDIATE: true,
  TRIGGER: 'click',
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 1024,
  CAPTURE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1,
  VELOCITY_DISSIPATION: 0.2,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
  SHADING: true,
  COLORFUL: true,
  COLOR_UPDATE_SPEED: 10,
  PAUSED: false,
  BACK_COLOR: { r: 0, g: 0, b: 0 },
  TRANSPARENT: false,
  BLOOM: true,
  BLOOM_ITERATIONS: 8,
  BLOOM_RESOLUTION: 256,
  BLOOM_INTENSITY: 0.8,
  BLOOM_THRESHOLD: 0.6,
  BLOOM_SOFT_KNEE: 0.7,
  SUNRAYS: true,
  SUNRAYS_RESOLUTION: 196,
  SUNRAYS_WEIGHT: 1.0,
})

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      darkBackgroundModes: [
        'day',
        'terminal',
        'torquoise',
        'alizarin',
        'amythyst',
        'carrot',
        'peterriver'
      ],
      lightBackgroundModes: [
        'night',
        'lightred',
        'lightpurple',
        'lightgreen',
        'lightblue',
        'lightyellow'
      ],
      backgroundType: Configs.backgroundType || 'plain',
      appClass: Configs.plainBackgroundMode || 'daylight',
      devIntro: Configs.devIntro || 'Lorem Ipsum',
      devDesc:
        Configs.devDesc ||
        'Aute veniam ut deserunt cillum irure pariatur Lorem dolore anim nostrud quis veniam elit culpa.',
      backgroundMode: 'default',
      backgroundIndex: 0,
      bgStyle: {},
      icons: Configs.icons || []
    };
  }

  componentWillMount = () => {
    
  };

  render() {
    const {
      appClass, bgStyle, backgroundMode, devIntro, devDesc, icons
    } = this.state;

    return (
      <div className={appClass} style={bgStyle}>
        <div
          className={backgroundMode}
        >
          <main className="App-main">
            <div className="container">
              <h1 className="intro">{devIntro}</h1>
              <div className="shell">$ git push --force</div>
              <div className="tagline">
                <Typist>{devDesc}</Typist>
              </div>
              
              <div className="icons-social">
                {icons.map((icon, i) => (
                  <a
                    target="_blank"
                    key={i}
                    rel="noopener noreferrer"
                    href={`${icon.url}`}
                  >
                    <i className={icon.image} />
                  </a>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }
}

export default App;
