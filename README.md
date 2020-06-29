Onkyo/Pioneer receiver app for Homey.

Control your Onkyo network-enabled receiver using the Homey by Athom B.V.
Some Pioneer receivers will also work.

Needs Homey firmware 3.1.0 or higher.
Completely new coding.

WARNING :   Because of the new coding the old app(v2.3.1 or below) completely breaks down all devices and flows.
            Advice is to remove all devices and deinstall the app.        
           
Features
* Gerenal settings for:
    * IPaddress
    * Port (typical ports used are 60128, 8102 or 23)
    * Maximum volume settings (Maximum volume that will be send to receiver and slider scaling)
    * Volumestep (for the + and - on the devicecard(s))
    * Receiver volumestep (some receivers do 0,5 volume steps instead of normal 1 steps)
    
Sererate devicecards for main zone, zone2 and zone3 (main zone is mandatory)

Capabiltys on devicecards:
* On/off
* Mute on/off
* Volumeslider (scaling with the Maximum volume setting)
* Volumeup  (with volumestep setting)
* Volumedown  (with volumestep setting)
* Input

Flowtrggers:
* power on
* power off
* volume change
* Receive custom command (general flow)

Flowconditions
* Turned on / off

Flowactions
* Turn on
* Turn off
* Toggle on/off
* Set volume to.
* Mute the volume
* Unmute te volume
* Turn the volume down
* Turn the volume up
* Send custom command (general flow)
* Send RAW EISCP command (general flow)

After install go to the general settings and set the ipPaddress, port, maxvolume, volumestep and receiver volumestep.
Add the device(s), main zone is mandatory.

App using the node-eiscp from https://github.com/tillbaks/node-eiscp.
For the sending and receiving custom command flows, see the complete command list on https://github.com/mickelluiten/com.onkyoreceiver/blob/master/eiscp-commands-info.txt
The syntax is:  zone.command=argument.
* Example :  main.power=on			
* Example :  zone2.volume=22

Also possible to send RAW EISCP command like PWR00 for power OFF or PWR01 for power ON
Check the command list 

	

