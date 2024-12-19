---
title: "Setting Up Kali Linux on an M2 Mac."
description: Setting up Kali Linux on an M2 Mac for penetration testing and ethical hacking.
date: 2024-12-19
tags: ["Kali Linux", "M2 Mac", "UTM", "Penetration Testing", "Ethical Hacking"]
---

## Table of Contents

- [Introduction](#introduction)
- [Gathering Required Software and Installer](#gathering-required-software-and-installer)
- [Installing UTM](#installing-utm)
- [Installation Setup](#installation-setup)
- [Installing Kali Linux](#installing-kali-linux)
- [Japanese Input Setup (fcitx)](#japanese-input-setup-fcitx)
- [Text Sharing Between Host Machine and Virtual Environment](#text-sharing-between-host-machine-and-virtual-environment)
- [Github SSH Connection](#github-ssh-connection)
- [Network and SSH Server](#network-and-ssh-server)
- [References](#references)

I had experience setting up on an Intel Mac environment, but since I now have an M2, I decided to try setting it up there.

The main use of my Kali Linux is for obtaining the [OSCP](https://offsec.com/courses/pen-200/), which involves penetration testing and ethical hacking.

https://github.com/utmapp/UTM

UTM is an app for full system emulation using QEMU, a virtualization environment-building tool. There are other apps that support creating virtual environments, such as VirtualBox and VMware, but this one seemed more modern, so I chose it.

Additionally, I personally find the GUI of the latter two apps to be outdated.

When I set it up on the Intel Mac, I used dual booting, but with the M2 Mac, it's become difficult due to the internal security chip.

Therefore, using a virtual machine is the smarter option.

Also, the OSCP recommends using virtual environments for learning.
https://help.offsec.com/hc/en-us/articles/360049796792-Kali-Linux-Virtual-Machine

## Gathering Required Software and Installer

Download the installer marked as Recommended for Apple Silicon (ARM64) from here:  
https://www.kali.org/get-kali/#kali-installer-images (ARM64 .iso file).

## Installing UTM

You can also get it from the App Store, but it's free to use.  
It can be installed from the GitHub link provided on this page:  
https://docs.getutm.app/installation/macos/

## Installation Setup

1. Launch UTM, then select `Create a New Virtual Machine` > `Virtualize`.
2. In the Operating System modal, choose `Other`.
3. Click Browse and select the .iso file you just downloaded.
4. Set memory to 2048MB and storage to 32GB, which should be sufficient.
5. In the Summary modal, enter any name, and check the box for `Open VM Settings`.
6. Confirm the virtual machine appears in the sidebar, then click the edit button at the top-right of the virtual machine.
7. In `Device`, select `New` > `Serial` (this is to prevent the terminal from blacking out during installation).

## Installing Kali Linux

1. Click Play.
2. Select `Japanese` for the language, and also choose `Japanese` for the keyboard (since your Mac has a Japanese layout).
3. Set the timezone to `Asia`.
4. The setup will ask various questions, but the default options should be fine.
5. Select `Guided - use entire disk` for partitioning.
6. Choose `All files in one partition (recommended for new users)` for the partitioning scheme.
7. Choose `Finish partitioning and write changes to disk`.
8. The installation will start, and you can proceed with the default options.
9. Once prompted, shut down the virtual machine to reboot.
10. In the previously set edit menu, remove the `Serial` device from `Device` and click `Save`.
11. In the home screen, unmount the .iso file from `CD/DVD` under the virtual machine's settings.
12. Click Play to start the virtual machine, and once it boots, you're done.

## Japanese Input Setup (fcitx)

```shell
sudo apt update
sudo apt install fcitx fcitx-mozc
im-config         # Opens the settings modal
```

In the config modal > select fcitx > add input method (select Mozc)

By default, input switching is done with `ctrl+space`, but since my Mac uses the Japanese layout, I assigned it to the `Henkanmode` key (Kana key).

## Text Sharing Between Host Machine and Virtual Environment

Since clipboard sharing didn't work, I used the following workaround:

- [HackMD](https://hackmd.io/)

## Github SSH Connection

This follows the configuration of my dotfiles.

```shell
ssh-keygen -t ed25519 -C "YOUR_EMAIL_ADDRESS"
```

Since Kali doesn't have a `pbcopy` equivalent, I installed the `xclip` command:  
https://github.com/astrand/xclip

```shell
sudo apt-get install xclip
```

Copy the key:

```shell
xclip -selection clipboard < ~/.ssh/id_ed25519.pub
```

Add the SSH key in GitHub's settings under `SSH and GPG keys` and paste the key there.

```shell
ssh -T git@github.com
Hi Coordinate-Cat! You've successfully authenticated, but GitHub does not provide shell access.
```

To fully use GitHub, you also need to configure `~/.gitconfig`:

```
[user]
    name = YOUR_ACCOUNT_ID
    email = YOUR_EMAIL_ADDRESS
```

Then you can commit or push.

## Network and SSH Server

Kali Linux comes with an SSH server pre-installed but is disabled by default, so you need to enable it.

1. [On Kali Linux] `sudo systemctl start ssh`
2. [On Kali Linux] `sudo systemctl enable ssh`
3. [On Kali Linux] Check the IP address with `ifconfig` (something like 192.xxx.xx.x).
4. [On Mac] `ssh ocat@192.xxx.xx.x` (don’t do this as root to avoid being compromised).
5. [On Mac] Enter the password, which is the Kali Linux password.
6. [On Mac] If it's the first time, you may see a message like "The authenticity of host 'xxx.xxx.xx.xx (xxx.xxx.xx.x)' can't be established." Type `yes`.
7. [On Mac] When you see the Kali Linux prompt, you're all set.

## References

- [How to Install Kali Linux on an M1 or M2 Mac](https://www.macobserver.com/tips/how-to/install-kali-linux-m1-m2-mac/)
- [kali-org](https://www.kali.org/get-kali/#kali-installer-images)
- [Generating a new SSH key and adding it to the ssh-agent](https://docs.github.com/ja/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
- [fcitx-mozc](https://archlinux.org/packages/extra/x86_64/fcitx-mozc/)

---
