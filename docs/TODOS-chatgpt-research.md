I want to parse the information gathered from: 
git remote -v 

I have questions about my approach: 
* is this a "porcelain" way to get the info? 
* What is the best way to ensure reliability across different versions of git when I do this as part of an automated toolchain?





Please create a create-github-key.sh for me
When called without parameters
prompt for email (use "your_email@example.com" as default)
prompt for hostname (use the result of running hostname as the default value)

When two parameters are given use those for email and hostname instead of prompting

Then please create in ~/.ssh/ the key pair with base name:

github-ssh-key--<hostname>--<email>

replace <hostname> and <email> with a shell save mangled version of those.

Please use a suitable variation of 
ssh-keygen -t ed25519 -C "your_email@example.com"
to generate the key pair.


Thanks for explaining this so well. I think I have used the keys in a suboptimal way till now.

Please create two shell scripts: 
* create-github-key-and-add-to-sshconfig.sh
* load-github-key.sh
If anything is unclear please just ask.


these are great but I need two modifications please:
1) Assume there exists an ./secrets/identity.sh with the following or similar content:

echo "someone is sourcing or executing .secrets/identity.sh"
DEFAULT_EMAIL="your_email@example.com"
DEFAULT_HOSTNAME="$(hostname)"
### use this variation if you know what you are doing
HOST_ALIAS="github-<SAFE_HOSTNAME>--<SAFE_EMAIL>"
### for noobs ;)
# HOST_ALIAS="github.com"

please use email and hostname from there if this file exists otherwise just use the already established mechanism for getting the email and hostname

2) when possible: please ensure to do all tests that could fail before creating any files or modifying anything. The "SSH config already contains Host block" check for example


Yes please refuse if the script would append a host alias that already exists.
Also I made some mistakes in how the ./secrets/identity.sh works and how it is used exactly. It should look like like this:

EMAIL="wizards23+github@gmail.com"
HOSTNAME="$(hostname)"
GITHUB_HOST_ALIAS="github-<SAFE_HOSTNAME>--<SAFE_EMAIL>"

If any of those is missing please use exactly the values from my example identity as defaults.

Please adapt both scripts accordingly.


Yes that is a good idea! refuse if the key files already exist but only one of the pair exists (e.g., private exists without .pub), because that usually indicates a broken state.

This looks weird to me:
DEFAULT_HOSTNAME=''"$(hostname)"''

Thanks for trying to follow my instructions exactly but this one seems to be taken too verbatim ;)
Please fix this.










