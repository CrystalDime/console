import React from 'react';
import styled from '@emotion/styled';
import { Box, Button, Card, Stack, Tooltip, CircularProgress } from '@mui/material';
import { useRecoilState } from 'recoil';
import { useFormikContext } from 'formik';
import { activeCertificate, keplrState, rpcEndpoint } from '../recoil/atoms';
import { getAccountBalance } from '../recoil/api/bank';
import { createAndBroadcastCertificate } from '../recoil/api';
import { Icon } from '../components/Icons';
import Delayed from '../components/Delayed';
import { Text, Title } from '../components/Text';
import { uaktToAKT } from '../_helpers/lease-calculations';
import { useWallet } from '../hooks/useWallet';
import { ManifestVersion } from '../_helpers/deployments-utils';
import { SDLSpec } from '../components/SdlConfiguration/settings';
import { queryCertificates } from '../recoil/queries';
import { useQuery } from 'react-query';
import { Certificate_State } from '@akashnetwork/akashjs/build/protobuf/akash/cert/v1beta2/cert';

export const PreflightCheck: React.FC<{}> = () => {
  const [hasKeplr, setHasKeplr] = React.useState(false);
  const [keplr,] = useRecoilState(keplrState);
  const [balance, setBalance] = React.useState(0);
  const { submitForm, values } = useFormikContext();
  const [certificate, setCertificate] = useRecoilState(activeCertificate);
  const { data: accountCertificates } = useQuery(
    ['certificates', keplr?.accounts[0]?.address],
    queryCertificates
  );
  const wallet = useWallet();
  const [isValidCert, setIsValidCert] = React.useState(false);
  const sdl = (values as { sdl: SDLSpec }).sdl;
  const [manifestVersion, setManifestVersion] = React.useState<Uint8Array>();
  const [loading, setLoading] = React.useState(false);
  const [showVarifiedCert, setShowVarifiedCert] = React.useState(false);

  React.useEffect(() => {
    try {
      ManifestVersion(sdl).then(setManifestVersion);
    } catch (e) {
      console.warn("Could not compute manifest version: ", e);
      setManifestVersion(undefined);
    }
  }, [sdl])

  React.useEffect(() => {
    if (accountCertificates && accountCertificates.certificates) {
      const activeCert = accountCertificates.certificates.find((cert: any) => {
        const pubKey = Buffer.from(cert.certificate.pubkey, 'base64').toString('ascii');
        return certificate.$type === 'TLS Certificate' && certificate.publicKey === pubKey;
      });

      setIsValidCert(!!(activeCert && activeCert?.certificate?.state === Certificate_State.valid));
    }
  }, [certificate, accountCertificates]);

  React.useEffect(() => {
    if (window.keplr) {
      setHasKeplr(true);
    }
  }, []);

  React.useEffect(() => {
    handleConnectWallet();
  }, []);

  React.useEffect(() => {
    if (!window.keplr) return;
    if (keplr.isSignedIn && keplr?.accounts[0]?.address) {
      getAccountBalance(keplr.accounts[0].address).then((result) => {
        const akt = uaktToAKT(result);
        setBalance(akt);
      });
    }
  }, [keplr]);

  const handleConnectWallet = async () => {
    if (!wallet.isConnected) {
      wallet.connect();
    }
  };

  React.useEffect(() => {
    if(showVarifiedCert){
      setIsValidCert(true);
    }
  }, [showVarifiedCert]);

  const handleCreateCertificate = async () => {
    setLoading(true);
    const result = await createAndBroadcastCertificate(rpcEndpoint(), keplr);

    if (result.code === 0 && result.certificate) {
      setCertificate(result.certificate);
      setShowVarifiedCert(true);
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={2}
      sx={{
        '& .MuiTextField-root': { m: 1, width: '25ch' },
        margin: '0 auto',
        width: '821px',
      }}
    >
      <PreflightCheckWrapper>
        <div>
          <Title size={18} className="h-12 pb-6">
            Checking Essentials
          </Title>
          <Delayed>
            {/* Check Keplr & Login */}
            <Stack sx={{ width: '100%' }} spacing={0}>
              {!hasKeplr && (
                <PreflightCheckItem>
                  <div className="flex mb-2">
                    <Icon type="alert" />
                    <Title size={14} className="pl-2">
                      You will need to install the Keplr wallet extension for Chrome.
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                    <a
                      href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap"
                      target="_blank"
                    >
                      <PreflightActionButton>Get Keplr</PreflightActionButton>
                    </a>
                    <Tooltip title="Sign in to your Keplr wallet" placement="top">
                      <div className="ml-2">
                        <Icon type="infoGray" />
                      </div>
                    </Tooltip>
                  </div>
                  <Text size={14}>In order to deploy you will need to connect your wallet.</Text>
                </PreflightCheckItem>
              )}
            </Stack>

            <Stack sx={{ width: '100%', marginBottom: '16px' }} spacing={0}>
              {hasKeplr && !keplr.isSignedIn ? (
                <PreflightCheckItem>
                  <div className="flex mb-2">
                    <Icon type="alert" />
                    <Title size={14} className="pl-2">
                      Connect your Wallet
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                    <PreflightActionButton onClick={handleConnectWallet}>
                      Connect Wallet
                    </PreflightActionButton>
                    <Tooltip title="Sign in to your Keplr wallet" placement="top">
                      <div className="ml-2">
                        <Icon type="infoGray" />
                      </div>
                    </Tooltip>
                  </div>
                  <Text size={14}>In order to deploy you will need to connect your wallet.</Text>
                </PreflightCheckItem>
              ) : null}
              {hasKeplr && keplr.isSignedIn ? (
                <PreflightCheckItem>
                  <div className="flex">
                    <Icon type="checkVerified" />
                    <Title size={14} className="pl-3">
                      Wallet Connected
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                  </div>
                </PreflightCheckItem>
              ) : null}
            </Stack>

            {/* Check Funds */}
            <Stack sx={{ width: '100%', marginBottom: '16px' }} spacing={0}>
              {balance < 5 && (
                <PreflightCheckItem>
                  <div className="flex mb-2">
                    <Icon type="alert" />
                    <Title size={14} className="pl-2">
                      Insufficient funds in your wallet
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                  </div>
                  <Text size={14}>
                    Minimum wallet balance is at least 5 AKT. You can add funds to your wallet or
                    specify an authorized depositor.
                  </Text>
                </PreflightCheckItem>
              )}
              {balance >= 5 ? (
                <PreflightCheckItem>
                  <div className="flex">
                    <Icon type="checkVerified" />
                    <Title size={14} className="pl-2">
                      Wallet Funds Sufficient
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                  </div>
                </PreflightCheckItem>
              ) : null}
            </Stack>

            {/* Validate SDL */}
            <Stack sx={{ width: '100%', marginBottom: '16px' }} spacing={0}>
              {manifestVersion === undefined && (
                <PreflightCheckItem>
                  <div className="flex mb-2">
                    <Icon type="alert" />
                    <Title size={14} className="pl-2">
                      Invalid SDL
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                  </div>
                  <Text size={14}>
                    SDL could not be validated. Please double-check and ensure all values are correct.
                    {manifestVersion}
                  </Text>
                </PreflightCheckItem>
              )}
              {manifestVersion !== undefined ? (
                <PreflightCheckItem>
                  <div className="flex">
                    <Icon type="checkVerified" />
                    <Title size={14} className="pl-2">
                      SDL is Valid
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                  </div>
                </PreflightCheckItem>
              ) : null}
            </Stack>

            {/* Check Certificate */}
            <Stack sx={{ width: '100%', marginBottom: '16px' }} spacing={0}>
              {!isValidCert && (
                <PreflightCheckItem>
                  <div className="flex mb-2">
                    <Icon type="alert" />
                    <Title size={14} className="pl-2">
                      {loading ? 'Please wait, creating certificate...' : 'Missing Certificate'}
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                    <PreflightActionButton onClick={handleCreateCertificate}>
                      Create Certificate
                    </PreflightActionButton>
                    <Tooltip
                      title="Create a valid certificate on the Akash Network."
                      placement="top"
                    >
                      <div className="ml-2">
                        <Icon type="infoGray" />
                      </div>
                    </Tooltip>
                  </div>
                  <Text size={14}>{loading ? <div className="flex justify-center"> <CircularProgress /> </div> : 'In order to deploy you will need to create a certificate.'}</Text>
                </PreflightCheckItem>
              )}
              {isValidCert ? (
                <PreflightCheckItem>
                  <div className="flex">
                    <Icon type="checkVerified" />
                    <Title size={14} className="pl-2">
                      Valid Certificate
                    </Title>
                    <div className="grow">{/* spacer - do not remove */}</div>
                  </div>
                </PreflightCheckItem>
              ) : null}
            </Stack>
          </Delayed>
        </div>
      </PreflightCheckWrapper>
      <DeploymentAction>
        <Button variant="contained" onClick={submitForm}>
          Next
        </Button>
      </DeploymentAction>
    </Box>
  );
};

const DeploymentAction = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const PreflightCheckWrapper = styled(Card)`
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 24px;
  min-height: 320px;
`;

const PreflightCheckItem = styled.div`
  width: 100%;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
`;

const PreflightActionButton = styled(Button)`
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-family: 'Satoshi-Regular';
  font-style: normal;
  font-weight: 800;
  font-size: 12px;
  padding: 2px 16px;
  height: 38px;
  width: 132px;
  text-transform: none;
`;
