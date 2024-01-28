cmake_minimum_required(VERSION 3.10)
set (CMAKE_CXX_STANDARD 17)

project(binding)
add_definitions(-DNAPI_VERSION=3)
include_directories(${CMAKE_JS_INC})
file(GLOB SOURCE_FILES src/*.cc src/**/*.cc)

# you must have this before `add_library`
link_directories(${CMAKE_SOURCE_DIR}/deps/occt/lib)

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})

execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR)
string(REPLACE "\n" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
target_include_directories(${PROJECT_NAME} PRIVATE ${NODE_ADDON_API_DIR})

target_include_directories(${PROJECT_NAME} PRIVATE deps/occt/include)
IF (WIN32)
target_link_libraries(${PROJECT_NAME} TKBin TKBinL TKBinTObj TKBinXCAF TKBO TKBool TKBRep TKCAF TKCDF TKD3DHost TKDCAF TKDFBrowser TKDraw TKernel TKFeat TKFillet TKG2d TKG3d TKGeomAlgo TKGeomBase TKHLR TKIGES TKIVtk TKIVtkDraw TKLCAF TKMath TKMesh TKMeshVS TKOffset TKOpenGl TKPrim TKQADraw TKRWMesh TKService TKShapeView TKShHealing TKStd TKStdL TKSTEP TKSTEP209 TKSTEPAttr TKSTEPBase TKSTL TKTInspector TKTInspectorAPI TKTObj TKTObjDRAW TKToolsDraw TKTopAlgo TKTopTest TKTreeModel TKV3d TKVCAF TKView TKViewerTest TKVInspector TKVRML TKXCAF TKXDEDRAW TKXDEIGES TKXDESTEP TKXMesh TKXml TKXmlL TKXmlTObj TKXmlXCAF TKXSBase TKXSDRAW)
string(REPLACE "/" "\\" PROJECT_BINARY_DIR_WIN ${PROJECT_BINARY_DIR})
string(REPLACE "/" "\\" CMAKE_SOURCE_DIR_WIN ${CMAKE_SOURCE_DIR})
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD 
  COMMAND cmd /c copy 
     "${CMAKE_SOURCE_DIR_WIN}\\deps\\occt\\bin\\*"
     "${PROJECT_BINARY_DIR_WIN}\\$<CONFIGURATION>\\"
  COMMENT "Copying to output directory")
ELSE()
target_link_libraries(${PROJECT_NAME} TKTObjDRAW.a TKQADraw.a TKXDEDRAW.a TKDCAF.a TKDCAF.a TKXSDRAW.a TKViewerTest.a TKTopTest.a TKDraw.a TKXDESTEP.a TKBinXCAF.a TKXmlXCAF.a TKXDEIGES.a TKXCAF.a TKIGES.a TKSTEP.a TKSTEP209.a TKSTEPAttr.a TKSTEPBase.a TKXSBase.a TKStd.a TKStdL.a TKXml.a TKBin.a TKXmlL.a TKBinL.a TKCAF.a TKXCAF.a TKLCAF.a TKCDF.a TKMeshVS.a TKOpenGl.a TKV3d.a TKService.a TKXMesh.a TKMesh.a TKOffset.a TKFeat.a TKFillet.a TKHLR.a TKBool.a TKBO.a TKShHealing.a TKPrim.a TKTopAlgo.a TKGeomAlgo.a TKBRep.a TKGeomBase.a TKG3d.a TKG2d.a TKMath.a TKernel.a)
ENDIF()
