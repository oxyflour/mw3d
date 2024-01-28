#include "step.h"

#include <STEPControl_Reader.hxx>
#include <STEPControl_Writer.hxx>

#include <XSControl_WorkSession.hxx>
#include <XSControl_TransferReader.hxx>

#include <TopExp_Explorer.hxx>
#include <TopAbs_ShapeEnum.hxx>
#include <Standard_CString.hxx>
#include <StepShape_ManifoldSolidBrep.hxx>
#include <StepVisual_StyledItem.hxx>
#include <StepVisual_PresentationLayerAssignment.hxx>
#include <StepVisual_StyledItem.hxx>
#include <StepVisual_PresentationStyleSelect.hxx>
#include <StepVisual_PresentationStyleAssignment.hxx>
#include <StepVisual_SurfaceStyleUsage.hxx>
#include <StepVisual_SurfaceSideStyle.hxx>
#include <StepVisual_SurfaceStyleFillArea.hxx>
#include <StepVisual_FillAreaStyle.hxx>
#include <StepVisual_FillAreaStyleColour.hxx>
#include <StepVisual_Colour.hxx>
#include <StepVisual_ColourRgb.hxx>
#include <Transfer_TransientProcess.hxx>
#include <TransferBRep.hxx>

#include "../topo/shape.h"

auto UpdateMeta(STEPControl_Reader &reader) {
    auto model = reader.WS()->Model();
    auto trans = reader.WS()->TransferReader();
    // https://github.com/Open-Cascade-SAS/OCCT/blob/fd5c113a0367cc5e0b086544f2e900265545aa72/src/STEPCAFControl/STEPCAFControl_Reader.cxx#L1468
    auto &proc = trans->TransientProcess();
    for (int i = 0; i < model->NbEntities(); i ++) {
        auto ent = model->Value(i + 1);
        if (ent->IsKind(StepVisual_PresentationLayerAssignment::get_type_descriptor())) {
            auto layer = Handle(StepVisual_PresentationLayerAssignment)::DownCast(ent);
            for (int i = 0; i < layer->NbAssignedItems(); i ++) {
                auto item = layer->AssignedItemsValue(i + 1);
                auto bind = proc->Find(item.Value());
                auto shape = TransferBRep::ShapeResult(proc, bind);
                auto &meta = Shape::MetaMap[shape.HashCode(0x0fffffff)];
                meta["LayerName"] = layer->Name()->ToCString();
                meta["LayerDescription"] = layer->Description()->ToCString();
            }
        } else if (ent->IsKind(StepVisual_StyledItem::get_type_descriptor())) {
            auto style = Handle(StepVisual_StyledItem)::DownCast(ent);
            auto bind = proc->Find(style->Item());
            if (bind.IsNull()) {
                continue;
            }
            auto shape = TransferBRep::ShapeResult(proc, bind);
            if (shape.ShapeType() != TopAbs_ShapeEnum::TopAbs_SOLID) {
                continue;
            }
            for (int i = 0; i < style->NbStyles(); i ++) {
                auto item = style->StylesValue(i + 1);
                for (int j = 0; j < item->NbStyles(); j ++) {
                    auto value = item->StylesValue(j + 1);
                    auto usage = value.SurfaceStyleUsage();
                    if (usage.IsNull()) {
                        continue;
                    }
                    auto style = usage->Style();
                    for (int k = 0; k < style->NbStyles(); k ++) {
                        auto item = style->StylesValue(k + 1);
                        auto fill = item.SurfaceStyleFillArea();
                        if (fill.IsNull()) {
                            continue;
                        }
                        auto area = fill->FillArea();
                        if (area.IsNull()) {
                            continue;
                        }
                        for (int u = 0; u < area->NbFillStyles(); u ++) {
                            auto item = area->FillStylesValue(u + 1);
                            auto color = item.FillAreaStyleColour()->FillColour();
                            auto rgb = Handle(StepVisual_ColourRgb)::DownCast(color);
                            auto &meta = Shape::MetaMap[shape.HashCode(0x0fffffff)];
                            meta["ColorRGB"] =
                                std::to_string(rgb->Red()) + "," +
                                std::to_string(rgb->Green()) + "," +
                                std::to_string(rgb->Blue());
                            // WTF
                            break;
                            break;
                            break;
                            break;
                        }
                    }
                }
            }
        }
    }
    TopExp_Explorer exp;
    for (exp.Init(reader.Shape(), TopAbs_ShapeEnum::TopAbs_SOLID); exp.More(); exp.Next()) {
        auto &shape = exp.Current();
        auto ent = trans->EntityFromShapeResult(shape, 1);
        if (!ent.IsNull() && ent->IsKind(StepShape_ManifoldSolidBrep::get_type_descriptor())) {
            auto prop = Handle(StepShape_ManifoldSolidBrep)::DownCast(ent);
            auto &meta = Shape::MetaMap[shape.HashCode(0x0fffffff)];
            meta["ManifoldSolidBrep"] = prop->Name()->ToCString();
        }
    }
}

Napi::Value LoadStep(const Napi::CallbackInfo &info) {
    std::string file = info[0].As<Napi::String>();
    STEPControl_Reader reader;
    auto stat = reader.ReadFile(file.c_str());
    if (stat != IFSelect_RetDone) {
        auto msg = std::string("read from ") + file + " failed";
        Napi::Error::New(info.Env(), msg).ThrowAsJavaScriptException();
        return info.Env().Undefined();
    } else {
        reader.TransferRoot();
        UpdateMeta(reader);
        return Shape::Create(reader.Shape());
    }
}

Napi::Value SaveStep(const Napi::CallbackInfo &info) {
    std::string file = info[0].As<Napi::String>();
    STEPControl_Writer writer;
    auto shape = Shape::Unwrap(info[1].As<Napi::Object>())->shape;
    auto stat = writer.Transfer(shape, STEPControl_StepModelType::STEPControl_AsIs);
    if (stat != IFSelect_RetDone) {
        auto msg = std::string("write to ") + file + " failed";
        Napi::Error::New(info.Env(), msg).ThrowAsJavaScriptException();
    } else {
        writer.Write(file.c_str());
    }
    return info.Env().Undefined();
}
