(function () {
    'use strict';

    app.initApp = function () {
        app.page = app.page || {};
        let idpHint = $(this).data('idp-hint');
        let options = {
            clientId: 'Arketype',
            environment: app.env,
            skipAuthentication: true
        };
        if (idpHint) {
            options.authenticationOptions = {idpHint: idpHint}
        }
        let networkName = $('#settings-rpc-name').val();
        let nodeUrl = $('#settings-rpc-endpoint').val();
        if (networkName && nodeUrl) {
            options.network = {
                name: $('#settings-rpc-name').val(),
                nodeUrl: $('#settings-rpc-endpoint').val()
            }
        }

        console.log('initializing arkane web3 provider with', options);
        Arkane.createArkaneProviderEngine(options)
            .then(function (provider) {
                window.web3 = new Web3(provider);
                handleWeb3Loaded();
            })
            .catch((reason) => {
                if (reason) {
                    switch (reason) {
                        case 'not-authenticated':
                            console.log('User is not authenticated (closed window?)', reason);
                            break;
                        case 'no-wallet-linked':
                            console.log('No wallet was linked to this application', reason);
                            break;
                        default:
                            console.log('Something went wrong while creating the Arkane provider', reason);
                    }
                } else {
                    console.log('Something went wrong while creating the Arkane provider');
                }
            });

        $('.auth-loginlink').on('click', function (event) {
            let idpHint = $(this).data('idp-hint');
            let authenticationOptions = {};
            if (idpHint) {
                authenticationOptions.idpHint = idpHint;
            }
            Arkane.authenticate(authenticationOptions).then(account => {
                if (account) {
                    document.body.classList.remove('not-logged-in');
                    document.body.classList.add('logged-in');
                    $(app).trigger('authenticated');
                }
            })
        });

        $(app).on('authenticated', function () {
            window.web3.eth.subscribe('newBlockHeaders', function (error, result) {
                if (!error) {
                    return;
                }
                console.error('weird, an error!', error);
            })
                .on("data", function (blockHeader) {
                    app.log(blockHeader.number, 'New block');
                })
                .on("error", console.error);

            window.web3.eth.getAccounts().then(wallets => {
                app.log(wallets, 'Wallets');
                updateWallets(wallets);
            });

            if (!app.page.initialised) {
                initLogout();
                initWalletControls();
                initNetworkControls();
                initRequestTransactionForm();
                app.page.initialised = true;
            }
        });
    };

    function handleWeb3Loaded() {
        app.log(window.web3.version, 'web3 version');
        window.web3.eth.getChainId().then(network => {
            app.log(network, 'ChainID');
        });
        Arkane.checkAuthenticated().then(authResult => {
            if (authResult.isAuthenticated) {
                document.body.classList.remove('not-logged-in');
                document.body.classList.add('logged-in');
                $(app).trigger('authenticated');
            }
        });
    }

    function getWallets(el) {
        window.web3.eth.getAccounts(function (err, wallets) {
            app.log(wallets, 'Wallets');
            updateWallets(wallets);
        });
    }

    function initLogout() {
        $('#auth-logout').click(() => {
            window.Arkane.arkaneConnect().logout()
                .then(() => {
                    document.body.classList.remove('logged-in');
                    document.body.classList.add('not-logged-in');
                    app.clearLog();
                    clearWallets();
                });
        });
    }

    function initWalletControls() {
        initLinkWallets();
        initManageWallets();
        initRefreshWallets();
    }

    function initNetworkControls() {
        let networkName = $('#settings-rpc-name').val();
        let nodeUrl = $('#settings-rpc-endpoint').val();
        if (networkName && nodeUrl && Arkane.arkaneSubProvider.network) {
            $('#network-mgmt-rpc-name').val(Arkane.arkaneSubProvider.network.name);
            $('#network-mgmt-endpoint').val(Arkane.arkaneSubProvider.network.nodeUrl);
        }
    }

    function initLinkWallets() {
        $('#link-wallets').click(() => {
            window.Arkane.arkaneConnect()
                .linkWallets()
                .then(function () {
                    getWallets();
                });
        });
    }

    function initManageWallets() {
        $('#manage-wallets').click(() => {
            window.Arkane.arkaneConnect()
                .manageWallets('ETHEREUM')
                .then(function () {
                    getWallets();
                });
        });
    }

    function initRefreshWallets() {
        $('#refresh-wallets').click(() => {
            getWallets();
        });
    }


    function initRequestTransactionForm() {
        var signForm = document.querySelector('#sign-form');
        if (signForm) {
            signForm.addEventListener('submit', function (e) {
                e.stopPropagation();
                e.preventDefault();
                //add this if a popup blocker is being triggered
                window.Arkane.arkaneConnect().createSigner();

                var rawTransaction = {
                    from: $('select[name="from"]', signForm).val(),
                    to: $('input[name="to"]', signForm).val(),
                    value: $('input[name="value"]', signForm).val(),
                    gas: $('input[name="gas"]', signForm).val() || undefined,
                    gasPrice: $('input[name="gas-price"]', signForm).val() || undefined,
                    nonce: $('input[name="nonce"]', signForm).val() || undefined,
                    data: $('textarea[name="data"]', signForm).val() || undefined,
                };

                window.web3.eth.signTransaction(rawTransaction, (err, result) => {
                    if (err) {
                        app.error("error: " + err.message ? err.message : JSON.stringify(err));
                    } else {
                        app.log(result);
                    }
                });
            });
        }

        var executeForm = document.querySelector('#execute-form');
        if (executeForm) {
            executeForm.addEventListener('submit', function (e) {
                e.stopPropagation();
                e.preventDefault();

                //add this if a popup blocker is being triggered
                window.Arkane.arkaneConnect().createSigner();

                var rawTransaction = {
                    from: $('select[name="from"]', executeForm).val(),
                    to: $('input[name="to"]', executeForm).val(),
                    value: $('input[name="value"]', executeForm).val(),
                    gas: $('input[name="gas"]', executeForm).val() || undefined,
                    gasPrice: $('input[name="gas-price"]', executeForm).val() || undefined,
                    nonce: $('input[name="nonce"]', executeForm).val() || undefined,
                    data: $('textarea[name="data"]', executeForm).val() || undefined,
                };
                window.web3.eth.sendTransaction(rawTransaction, function (err, hash) {
                    if (err) console.error(err);
                })
                    .on('transactionHash', function (hash) {
                        app.log(hash, 'Tx hash');
                    })
                    .on('receipt', function (receipt) {
                        app.log(receipt, 'Tx receipt');
                    })
                    .on('error', function (err) {
                        app.error("error: " + err.message ? err.message : JSON.stringify(err));
                    });

            });
        }

        var eip712Form = document.querySelector('#eip712-form');
        if (eip712Form) {
            eip712Form.addEventListener('submit', function (e) {
                e.stopPropagation();
                e.preventDefault();

                //add this if a popup blocker is being triggered
                window.Arkane.arkaneConnect().createSigner();

                const data = $('textarea[name="data"]', eip712Form).val();
                const signer = $('select[name="from"]', eip712Form).val()
                window.web3.currentProvider.sendAsync(
                    {
                        method: "eth_signTypedData_v3",
                        params: [signer, data],
                        from: signer
                    },
                    function (err, result) {
                        if (err || result.error) {
                            return console.error(result);
                        }
                        app.log(result, 'EIP712 signature');
                    }
                );
            });
        }
    }

    function updateWallets(wallets) {
        const walletsSelect = $('select[name="from"]');
        walletsSelect && walletsSelect.empty();
        if (wallets) {
            wallets.forEach(wallet => walletsSelect.append($(
                '<option>',
                {value: wallet, text: wallet, 'data-address': wallet}
            )));
        }
    }

    function clearWallets() {
        const walletsSelect = $('select[name="from"]');
        walletsSelect && walletsSelect.empty();
    }
})();
