'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');


class onkyoApp extends Homey.App {

  onInit() {
    this.log('onkyoApp is running...');
    this.log(`ManagerSettings: -- ipAddress: ${ManagerSettings.get('ipAddressSet')}`);
    this.log(`ManagerSettings: -- Port: ${ManagerSettings.get('portSettings')}`);
    this.log(`ManagerSettings: -- ReceiverVolumestep: ${ManagerSettings.get('ReceiverVolumeStep')}`);
    this.log(`ManagerSettings: -- maxVolume: ${ManagerSettings.get('maxVolumeSet')}`);
    this.log(`ManagerSettings: -- volumeStep: ${ManagerSettings.get('volumeStepSet')}`);

  }

}

module.exports = onkyoApp;
