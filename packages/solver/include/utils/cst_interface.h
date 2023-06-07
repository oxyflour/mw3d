// Interface function declarations of the CSTResultReader.dll


// Copyright (c) 2012-2018 CST GmbH, a Dassault Systemes company
// All rights reserved.                     

// THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN 
// OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM 
// "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, 
// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS 
// TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU 
// ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

// INTERNAL NOTE: THIS FILE NEEDS TO GO TO THE INSTALLATION, USE BRANCH MAPPING

#ifndef CSTResultReaderInterf_03356389_33DF_4855_AB1B_DFC4F22DFFF1
#define CSTResultReaderInterf_03356389_33DF_4855_AB1B_DFC4F22DFFF1

#ifdef RESULT_READER_BUILD
	#define DllExport   __declspec( dllexport )
#else
	#define DllExport   __declspec( dllimport )
#endif

#define CST_CallConv __stdcall

#ifdef __cplusplus
extern "C" 
{
#endif // __cplusplus

	/////////////////////////////////////////////////////////////////////////////////
	// Further information can be found in the CST DESIGN ENVIRONMENT(TM) online help 
	/////////////////////////////////////////////////////////////////////////////////

	typedef struct {void *m_pProj;} CSTProjHandle;

	///////////////////////////////////////////////////////////////////////////////
	// dll Version
	DllExport int CST_CallConv CST_GetDLLVersion(int *nVersion);
	typedef int (CST_CallConv *CST_GetDLLVersion_PTR)(int *nVersion);

	///////////////////////////////////////////////////////////////////////////////
	// Open / Close a Project Handle
	DllExport int	CST_CallConv CST_OpenProject(char const *cProjName, CSTProjHandle *projHandle);
	typedef int		(CST_CallConv *CST_OpenProject_PTR)(char const *cProjName, CSTProjHandle *projHandle);
	DllExport int	CST_CallConv CST_CloseProject(CSTProjHandle *pHandle);
	typedef int	(CST_CallConv *CST_CloseProject_PTR)(CSTProjHandle *pHandle);

    //////////////////////////
    //
	DllExport int CST_CallConv CST_GetItemNames(CSTProjHandle const *projHandle, 
                                                char const *cTreePathName, 
                                                char* out_buffer,
                                                int out_buffer_len,
                                                int* num_items);

	///////////////////////////////////////////////////////////////////////////////
	// Number of Available Results Within the Given Result Tree.
	DllExport int CST_CallConv CST_GetNumberOfResults(CSTProjHandle const *projHandle, 
													  char const *cTreePathName, 
													  int *nResultNumber);

	typedef int (CST_CallConv *CST_GetNumberOfResults_PTR)(CSTProjHandle const *projHandle, 
														   char const *cTreePathName, 
														   int *nResultNumber);

	///////////////////////////////////////////////////////////////////////////////
	// Disk path for model or result depending on cPathType ("RESULT" / "MODEL3D")
	DllExport int CST_CallConv CST_GetProjectPath(CSTProjHandle const *projHandle, char const *cPathType, char *cPath);
	typedef int (CST_CallConv *CST_GetProjectPath_PTR)(CSTProjHandle const *projHandle, char const *cPathType, char *cPath);

	////////////////////////////////////////////////////////////////////////////////
	// 1D-Results
	DllExport int CST_CallConv CST_Get1DResultInfo(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, 
												  int infoArraySize, int charBufferSize, char *cInfo, int *iInfo, double *dInfo);    // length of data
	typedef int (CST_CallConv *CST_Get1DResultInfo_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, 
														int infoArraySize, int charBufferSize, char *cInfo, int *iInfo, double *dInfo);    // length of data

	DllExport int CST_CallConv CST_Get1DResultSize(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, int *nDataSize);    // length of data
	typedef int (CST_CallConv *CST_Get1DResultSize_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, int *nDataSize);    // length of data


	DllExport int CST_CallConv CST_Get1DRealDataOrdinate(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, double *dData);
	typedef int (CST_CallConv *CST_Get1DRealDataOrdinate_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, double *dData);

	DllExport int CST_CallConv CST_Get1DRealDataAbszissa(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, double *dData);
	typedef int (CST_CallConv *CST_Get1DRealDataAbszissa_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, double *dData);

	DllExport int CST_CallConv CST_Get1D_2Comp_DataOrdinate(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, double *dSParaComplex);
	typedef int (CST_CallConv *CST_Get1D_2Comp_DataOrdinate_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, double *dSParaComplex);
	
	////////////////////////////////////////////////////////////////////////////////
	// 3D-Results
	DllExport int CST_CallConv CST_Get3DHexResultInfo(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber,
													  int infoArraySize, int charBufferSize, char *cInfo, int *iInfo, double *dInfo);    
	typedef int (CST_CallConv *CST_Get3DHexResultInfo_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber,
														   int infoArraySize, int charBufferSize, char *cInfo, int *iInfo, double *dInfo);    // data type, length of data

	DllExport int CST_CallConv CST_Get3DHexResultSize(CSTProjHandle const *projHandle, char const *cTreePathName, 
													  int iResultNumber, int *nDataSize);    
	typedef int (CST_CallConv *CST_Get3DHexResultSize_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, 
														   int iResultNumber, int *nDataSize);    // data type, length of data

	DllExport int CST_CallConv CST_Get3DHexResult(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, float *fData);
	typedef int (CST_CallConv *CST_Get3DHexResult_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int iResultNumber, float *fData);

	////////////////////////////////////////////////////////////////////////////////
	// Farfields
	DllExport int CST_CallConv CST_GetNumberOfFarfieldMonitors(CSTProjHandle const *projHandle, int *nFFM);
	typedef int (CST_CallConv *CST_GetNumberOfFarfieldMonitors_PTR)(CSTProjHandle const *projHandle, int *nFFM);

	DllExport int CST_CallConv CST_GetFarfieldMonitorsInfo(CSTProjHandle const *projHandle, char ** Names, double * Frequencies);
	typedef int (CST_CallConv *CST_GetFarfieldMonitorsInfo_PTR)(CSTProjHandle const *projHandle, char ** Names, double * Frequencies);

	DllExport int CST_CallConv CST_GetFarfieldMonitorInfo(CSTProjHandle const *projHandle, int iMon, char * Name, double * Frequency);
	typedef int (CST_CallConv *CST_GetFarfieldMonitorInfo_PTR)(CSTProjHandle const *projHandle, int iMon, char * Name, double * Frequency);

	DllExport int CST_CallConv CST_GetFarfieldResultSize(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
								                         int Dimension, int *nDataSizeTheta, int *nDataSizePhi);
	typedef int (CST_CallConv *CST_GetFarfieldResultSize_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
															  int Dimension, int *nDataSizeTheta, int *nDataSizePhi);

	DllExport int CST_CallConv CST_GetFarfieldResultDirections(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
															   int Dimension, double *Directions);
	typedef int (CST_CallConv *CST_GetFarfieldResultDirections_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
																    int Dimension, double *Directions);

	DllExport int CST_CallConv CST_GetFarfieldResultField(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
														  int Dimension, double *Field_Real, double *Field_Imag);
	typedef int (CST_CallConv *CST_GetFarfieldResultField_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
															  int Dimension, double *Field_Real, int *Field_Imag);

	DllExport int CST_CallConv CST_GetFarfieldResultGaindB(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
														   int Dimension, double *GaindB);
	typedef int (CST_CallConv *CST_GetFarfieldResultGaindB_PTR)(CSTProjHandle const *projHandle, char const *cTreePathName, int isApprox, 
															    int Dimension, double *GaindB);

	////////////////////////////////////////////////////////////////////////////////
	// Probe Collection
	DllExport int CST_CallConv CST_GetProbeCollectionResultSize(CSTProjHandle const *projHandle, char const *sCollectionFile,
																int *nPoints, int *nFreq);
	typedef int (CST_CallConv *CST_GetProbeCollectionResultSize_PTR)(CSTProjHandle const *projHandle, char const *sCollectionFile,
																	 int *nPoints, int *nFreq);

	DllExport int CST_CallConv CST_GetProbeCollectionFreqList(CSTProjHandle const *projHandle, char const *sCollectionFile,
															  int nFreq, double *pFreq);
	typedef int (CST_CallConv *CST_GetProbeCollectionFreqList_PTR)(CSTProjHandle const *projHandle, char const *sCollectionFile,
																   int nFreq, double *pFreq);

	DllExport int CST_CallConv CST_GetProbeCollectionPointList(CSTProjHandle const *projHandle, char const *sCollectionFile,
															   int nPoints, double *pPoints[3]);
	typedef int (CST_CallConv *CST_GetProbeCollectionPointList_PTR)(CSTProjHandle const *projHandle, char const *sCollectionFile,
																	int nPoints, double *pPoints[3]);

	DllExport int CST_CallConv CST_GetProbeCollectionData(CSTProjHandle const *projHandle, char const *sCollectionFile,
														  int nPoints, int nFreq, double *pData[2]);
	typedef int (CST_CallConv *CST_GetProbeCollectionData_PTR)(CSTProjHandle const *projHandle, char const *sCollectionFile,
															   int nPoints, int nFreq, double *pData[2]);

	////////////////////////////////////////////////////////////////////////////////
	// Symmetries / Boundaries 
	DllExport int CST_CallConv CST_GetSymmetries(CSTProjHandle const *projHandle, int* nSymmetries);
	typedef int (CST_CallConv *CST_GetSymmetries_PTR)(CSTProjHandle const *projHandle, int* nSymmetries);

	DllExport int CST_CallConv CST_GetBoundaries(CSTProjHandle const *projHandle, int* nBoundary);
	typedef int (CST_CallConv *CST_GetBoundaries_PTR)(CSTProjHandle const *projHandle, int* nBoundary);
	
	/////////////////////////////////////////////////////////////////////////////////
	// Units
	// LENGTH = 1, TEMPERATURE = 2, VOLTAGE = 3, CURRENT = 4, RESISTANCE = 5, CONDUCTANCE = 6, 
	// CAPACITANCE = 7, INDUCTANCE = 8, FREQUENCY = 9, TIME = 10, POWER = 11

	DllExport int CST_CallConv CST_GetUnitScale(CSTProjHandle const *projHandle, int iUnit, double* dScale);
	typedef int (CST_CallConv *CST_GetUnitScale_PTR)(CSTProjHandle const *projHandle, int iUnit, double* dScale);
	
	DllExport int CST_CallConv CST_GetFrequencyScale(CSTProjHandle const *projHandle, double* FScale);
	typedef int (CST_CallConv *CST_GetFrequencyScale_PTR)(CSTProjHandle const *projHandle, double* FScale);

    DllExport int CST_CallConv CST_GetTimeScale(CSTProjHandle const *projHandle, double* TScale);
    typedef int (CST_CallConv *CST_GetTimeScale_PTR)(CSTProjHandle const *projHandle, double* TScale);

    DllExport int CST_CallConv CST_GetFrequencyMin(CSTProjHandle const *projHandle, double* FMin);
    typedef int (CST_CallConv *CST_GetFrequencyMin_PTR)(CSTProjHandle const *projHandle, double* FMin);

    DllExport int CST_CallConv CST_GetFrequencyMax(CSTProjHandle const *projHandle, double* FMax);
    typedef int (CST_CallConv *CST_GetFrequencyMax_PTR)(CSTProjHandle const *projHandle, double* FMax);

	////////////////////////////////////////////////////////////////////////////////
	// Excitations
	DllExport int CST_CallConv CST_GetNumberOfExcitations(CSTProjHandle const *projHandle, int *nExcitations);
	typedef int (CST_CallConv *CST_GetNumberOfExcitations_PTR)(CSTProjHandle const *projHandle, int* nExcitations);

	DllExport int CST_CallConv CST_GetExcitationStrings(CSTProjHandle const *projHandle, int nExc, char **psExc);
	typedef int (CST_CallConv *CST_GetExcitationStrings_PTR)(CSTProjHandle const *projHandle, int nExc, char **psExc);

	DllExport int CST_CallConv CST_GetExcitationString(CSTProjHandle const *projHandle, int iExc, char *psExc);
	typedef int (CST_CallConv *CST_GetExcitationString_PTR)(CSTProjHandle const *projHandle, int iExc, char *psExc);

	DllExport int CST_CallConv CST_GetPLWSettings(CSTProjHandle const *projHandle, double *dIncTheta, double *dIncPhi, double *dPolEta, double *dAmplitude);
	typedef int (CST_CallConv *CST_GetPLWSettings_PTR)(CSTProjHandle const *projHandle, double *dIncTheta, double *dIncPhi, double *dPolEta, double *dAmplitude);

	DllExport int CST_CallConv CST_GetPortImpedance(CSTProjHandle const *projHandle, int iPortNumber, int iModeNumber, 
													int nFreq, double const *freq, double *dPortImpComplex);
	typedef int (CST_CallConv *CST_GetPortImpedance_PTR)(CSTProjHandle const *projHandle, int iPortNumber, int iModeNumber, 
														 int nFreq, double const *freq, double *dPortImpComplex);
	DllExport int CST_CallConv CST_GetPortModeType(CSTProjHandle const *projHandle, int iPortNumber, int iModeNumber, char *pchType);
	typedef int (CST_CallConv *CST_GetPortModeType_PTR)(CSTProjHandle const *projHandle, int iPortNumber, int iModeNumber, char *pchType);
	DllExport int CST_CallConv CST_GetNumberOfPorts(CSTProjHandle const *projHandle, int *nPorts);
	typedef int (CST_CallConv *CST_GetNumberOfPorts_PTR)(CSTProjHandle const *projHandle, int *nPorts);
	DllExport int CST_CallConv CST_GetNumberOfModes(CSTProjHandle const *projHandle, int iPortNumber, int *nModes);
	typedef int (CST_CallConv *CST_GetNumberOfModes_PTR)(CSTProjHandle const *projHandle, int iPortNumber, int *nModes);

	/////////////////////////////////////////////////////////////////////////////////
	// Hexahedral mesh (Only Regular Grids, no Subgrids, no TST)
	DllExport int CST_CallConv CST_GetHexMeshInfo(CSTProjHandle const *projHandle, int *nxyz);
	typedef int (CST_CallConv *CST_GetHexMeshInfo_PTR)(CSTProjHandle const *projHandle, int *nxyz);
	
	DllExport int CST_CallConv CST_GetHexMesh(CSTProjHandle const *projHandle, double *nxyzLines);
	typedef int (CST_CallConv *CST_GetHexMesh_PTR)(CSTProjHandle const *projHandle, double *nxyzLines);

	/////////////////////////////////////////////////////////////////////////////////
	// Hexahedral Material Matrix
	// matType may be 0: Meps
	//                1: Mmue
	//                2: Mkappa
	DllExport int CST_CallConv CST_GetMaterialMatrixHexMesh(CSTProjHandle const *projHandle, int matType, float *fData);
	typedef int (CST_CallConv *CST_GetMaterialMatrixHexMesh_PTR)(CSTProjHandle const *projHandle, int matType, float *fData);

	/////////////////////////////////////////////////////////////////////////////////
	// BIX-File Information from Header
	DllExport int CST_CallConv CST_GetBixInfo(CSTProjHandle const *projHandle, char const *cBixName, int *nQuantities, int *nLines);
	typedef int (CST_CallConv *CST_GetBixInfo_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int *nQuantities, int *nLines);

	/////////////////////////////////////////////////////////////////////////////////
	// BIX-File Information about quantities
	// quantity types: Int32 = 1, Int64, Float32, Float64, Vector32, ComplexVector32, Vector64, SerialVector3x32, 
	// SerialVector6x32 = 9 // xre_0 yre_0 zre_0 xim_0 yim_0 zim_0 xre_1 yre_1 ... zim_n
	// UInt32 = 10, UInt64, Int8, UInt8, ComplexScalar32, ComplexScalar64, SerialComplexScalar32, SerialVector3x64
	DllExport int CST_CallConv CST_GetBixQuantity(CSTProjHandle const *projHandle, char const *cBixName, int iQuantity, int *iType, char *psQuantity);
	typedef int (CST_CallConv *CST_GetBixQuantity_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iQuantity, int *iType, char *psQuantity);

	/////////////////////////////////////////////////////////////////////////////////
	// BIX-File Information about length of lines
	DllExport int CST_CallConv CST_GetBixLineLength(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int *nLength);
	typedef int (CST_CallConv *CST_GetBixLineLength_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int *nLength);

	/////////////////////////////////////////////////////////////////////////////////
	// Read BIX-File data
	// Call with pointer to allocated memory (n*LineLength, n=3 for vector, n=6 for complex vector, see quantity type)
	DllExport int CST_CallConv CST_GetBixDataFloat(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, float *pData);
	typedef int (CST_CallConv *CST_GetBixDataFloat_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, float *pData);
	DllExport int CST_CallConv CST_GetBixDataDouble(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, double *pData);
	typedef int (CST_CallConv *CST_GetBixDataDouble_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, double *pData);
	DllExport int CST_CallConv CST_GetBixDataInt32(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, int *iData);
	typedef int (CST_CallConv *CST_GetBixDataInt32_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, int *fData);
	DllExport int CST_CallConv CST_GetBixDataInt64(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, __int64 *fData);
	typedef int (CST_CallConv *CST_GetBixDataInt64_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iLine, int iQuantity, __int64 *fData);

	/////////////////////////////////////////////////////////////////////////////////
	// Write BIX-File
	DllExport int CST_CallConv CST_AddBixQuantity(CSTProjHandle const *projHandle, char const *cBixName, int iType, char *psQuantity);
	typedef int (CST_CallConv *CST_AddBixQuantity_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int iType, char *psQuantity);
	DllExport int CST_CallConv CST_AddBixLine(CSTProjHandle const *projHandle, char const *cBixName, int nLength, char *psKey);
	typedef int (CST_CallConv *CST_AddBixLine_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int nLength, char *psKey);
	DllExport int CST_CallConv CST_WriteBixHeader(CSTProjHandle const *projHandle, char const *cBixName);
	typedef int (CST_CallConv *CST_WriteBixHeader_PTR)(CSTProjHandle const *projHandle, char const *cBixName);
	DllExport int CST_CallConv CST_WriteBixDataDouble(CSTProjHandle const *projHandle, char const *cBixName, int nLength, int iqType, double *dData);
	typedef int (CST_CallConv *CST_WriteBixDataDouble_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int nLength, int iqType, double *dData);
	DllExport int CST_CallConv CST_WriteBixDataInt32(CSTProjHandle const *projHandle, char const *cBixName, int nLength, int iqType, int *dData);
	typedef int (CST_CallConv *CST_WriteBixDataInt32_PTR)(CSTProjHandle const *projHandle, char const *cBixName, int nLength, int iqType, int *dData);
	DllExport int CST_CallConv CST_CloseBixFile(CSTProjHandle const *projHandle, char const *cBixName);
	typedef int (CST_CallConv *CST_CloseBixFile_PTR)(CSTProjHandle const *projHandle, char const *cBixName);


#ifdef __cplusplus
};
#endif // __cplusplus

#endif // #ifndef CSTResultReaderInterf_03356389_33DF_4855_AB1B_DFC4F22DFFF1

