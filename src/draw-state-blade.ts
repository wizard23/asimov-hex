import { BladeApi, BladeController, View } from '@tweakpane/core';
import { createBlade } from '@tweakpane/core';
import { ViewProps } from '@tweakpane/core';

interface DrawStateBladeConfig {
  numStates: number;
  palette: Record<number, string | { r: number; g: number; b: number; a?: number }>;
  drawState: number;
  onStateChange: (state: number) => void;
}

class DrawStateBladeView implements View {
  public readonly element: HTMLElement;
  private buttons: HTMLElement[] = [];

  constructor(config: DrawStateBladeConfig) {
    this.element = document.createElement('div');
    this.element.style.display = 'flex';
    this.element.style.gap = '4px';
    this.element.style.flexWrap = 'wrap';
    this.element.style.padding = '4px 0';

    for (let i = 0; i < config.numStates; i++) {
      const button = document.createElement('button');
      button.style.width = '24px';
      button.style.height = '24px';
      button.style.border = '2px solid #666';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.padding = '0';
      button.style.margin = '0';
      button.title = `State ${i}`;

      const colorValue = config.palette[i];
      const colorStr = typeof colorValue === 'string' ? colorValue : '#000000';
      button.style.backgroundColor = colorStr;

      // Calculate text color based on brightness
      const rgb = this.hexToRgb(colorValue);
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      button.style.color = brightness > 128 ? '#000000' : '#ffffff';

      button.addEventListener('click', () => {
        config.onStateChange(i);
        this.updateSelection(i, config.numStates);
      });

      this.element.appendChild(button);
      this.buttons.push(button);
    }

    this.updateSelection(config.drawState, config.numStates);
  }

  private updateSelection(selectedState: number, numStates: number) {
    this.buttons.forEach((button, index) => {
      if (index < numStates) {
        if (index === selectedState) {
          button.style.border = '3px solid #ffff00';
          button.style.boxShadow = '0 0 5px rgba(255, 255, 0, 0.8)';
        } else {
          button.style.border = '2px solid #666';
          button.style.boxShadow = 'none';
        }
      }
    });
  }

  public update(config: DrawStateBladeConfig) {
    // Remove old buttons
    this.buttons.forEach(btn => btn.remove());
    this.buttons = [];

    // Create new buttons
    for (let i = 0; i < config.numStates; i++) {
      const button = document.createElement('button');
      button.style.width = '24px';
      button.style.height = '24px';
      button.style.border = '2px solid #666';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.style.padding = '0';
      button.style.margin = '0';
      button.title = `State ${i}`;

      const colorValue = config.palette[i];
      const colorStr = typeof colorValue === 'string' ? colorValue : '#000000';
      button.style.backgroundColor = colorStr;

      const rgb = this.hexToRgb(colorValue);
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      button.style.color = brightness > 128 ? '#000000' : '#ffffff';

      button.addEventListener('click', () => {
        config.onStateChange(i);
        this.updateSelection(i, config.numStates);
      });

      this.element.appendChild(button);
      this.buttons.push(button);
    }

    this.updateSelection(config.drawState, config.numStates);
  }

  private hexToRgb(color: string | { r: number; g: number; b: number; a?: number }): { r: number; g: number; b: number } {
    let hex: string;
    if (typeof color === 'string') {
      hex = color;
    } else {
      const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
      const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
      const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
      hex = `#${r}${g}${b}`;
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
}

class DrawStateBladeController extends BladeController<DrawStateBladeView> {
  constructor(config: DrawStateBladeConfig) {
    super({
      blade: createBlade(),
      view: new DrawStateBladeView(config),
      viewProps: ViewProps.create(),
    });
  }
}

export class DrawStateBladeApi extends BladeApi<DrawStateBladeController> {
  constructor(controller: DrawStateBladeController) {
    super(controller);
  }

  public update(config: DrawStateBladeConfig) {
    (this.controller.view as DrawStateBladeView).update(config);
  }
}

export function createDrawStateBlade(config: DrawStateBladeConfig): DrawStateBladeApi {
  const controller = new DrawStateBladeController(config);
  return new DrawStateBladeApi(controller);
}

