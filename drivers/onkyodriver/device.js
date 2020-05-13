'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');

class onkyoDevice extends Homey.Device {

  onInit() {
    this.log('Device has been inited: ', this.getName());
    // register a listener for changes in de manager settingss.
    ManagerSettings.on('set', data => {
      this.log('Manager setting is changed');
      this.log(`IP Adress:   ${ManagerSettings.get('ipAddressSet')}`);
      this.log(`Max Volume:  ${ManagerSettings.get('maxVolumeSet')}`);
      this.log(`Volume Step: ${ManagerSettings.get('volumeStepSet')}`);
    });
    // this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));
  }

  getDeviceId() {
    return this.getData().id;
  }

  // Setting the maxvolume setting on volume_set capability to scale the slider and refresh device
  setSettingsVolumeSliderMax(maxVolumeValue) {
    this.setUnavailable();
    const caboptlist = this.getCapabilityOptions('volume_set.zone1');
    this.log(caboptlist);
    // this.setCapabilityOptions('volume_set.zone1', {
    //  min: 0, max: maxVolumeValue, step: 1, decimals: 0,
    // });
    // this.setCapabilityOptions('volume_set.zone2', options);
    // this.setCapabilityOptions('volume_set.zone3', options);
    this.setAvailable();
  }


  onAdded() {
    this.log(`Device "${this.getName()}" is added`);
    // this.setSettingsVolumeSliderMax();
  }


  // when device is deleted
  onDeleted() {
    this.log(`Device "${this.getName()}" is deleted`);
  }


}


module.exports = onkyoDevice;
